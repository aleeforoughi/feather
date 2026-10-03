"""A complete Feather caller in one file of standard-library Python (docs/callers.md).

It sends the ad campaign experience to a page, the page renders it with Feather, and the person's reply comes back
here to be validated before anything acts on it. Run it with `python3 examples/python-caller/server.py`, then open
http://localhost:8765. CI drives it end to end (examples/python-caller/e2e).

It uses the installed feather-sdk wheel, or the repository's packages/python with the embed bundle from
packages/embed/dist when run from a checkout.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
try:
    import feather_sdk
except ImportError:  # running from a checkout, without the wheel installed
    sys.path.insert(0, str(HERE.parents[1] / "packages" / "python"))
    import feather_sdk

from feather_sdk import experience, format_issues, nodes, validate, validate_reply

# The caller decides what the person must do. It never names a component, a color or a position.
APPROVE = experience(
    "approve_campaign",
    [
        nodes.Recommendation(
            id="rec",
            intent="launch the recommended test",
            importance="high",
            reversible=False,
            summary="Recommended test: 7 days, purchase objective",
            expandable={"why": "Enough to test three creative directions without overspending."},
        ),
        nodes.Price(id="cap", amount=1050, currency="AED", label="Maximum spend"),
        nodes.IrreversibleAction(
            id="go",
            intent="confirm spend",
            importance="critical",
            consequence={"spend": {"amount": 1050, "currency": "AED"}},
        ),
        nodes.Alternative(id="less", intent="spend less"),
        nodes.Alternative(id="own", intent="set my own budget", input="Price"),
    ],
)

checked = validate(APPROVE)
if not checked.ok:
    raise SystemExit(format_issues(checked.issues))

# The decisions this server accepted, newest last. A real caller acts on each one instead.
DECISIONS: list[dict] = []

PAGE = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>A Feather caller</title>
    <link rel="stylesheet" href="/feather/feather-embed.css">
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 44rem; padding: 0 1rem; }
      #status { margin-top: 1.5rem; }
    </style>
  </head>
  <body>
    <h1>Launch the campaign?</h1>
    <div id="decision"></div>
    <p id="status" role="status" data-testid="status">Waiting for your decision.</p>
    <script type="module">
      import { mount } from "/feather/feather-embed.js"

      const status = document.getElementById("status")
      const experience = await (await fetch("/api/experience")).json()
      mount(document.getElementById("decision"), experience, {
        onReply: async (reply) => {
          const response = await fetch("/api/reply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(reply) })
          const body = await response.json()
          status.textContent = response.ok ? `Server accepted: ${body.reply.node} ${body.reply.act}` : `Server rejected: ${body.issues}`
        },
        onIssues: (issues) => { status.textContent = `Invalid experience: ${issues.map((i) => i.code).join(", ")}` },
      })
    </script>
  </body>
</html>
"""


def bundle_dir() -> Path:
    """The browser bundle: the one inside the wheel, or packages/embed/dist in a checkout."""
    try:
        return Path(feather_sdk.static_dir())
    except FileNotFoundError:
        return HERE.parents[1] / "packages" / "embed" / "dist"


class Caller(BaseHTTPRequestHandler):
    def send_json(self, status: HTTPStatus, body: object) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802 (the stdlib's name)
        if self.path in ("/", "/index.html"):
            data = PAGE.encode()
            self.send_response(HTTPStatus.OK)
            self.send_header("content-type", "text/html; charset=utf-8")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif self.path == "/api/experience":
            self.send_json(HTTPStatus.OK, APPROVE)
        elif self.path == "/api/decisions":
            self.send_json(HTTPStatus.OK, DECISIONS)
        elif self.path.startswith("/feather/"):
            root = bundle_dir().resolve()
            file = (root / self.path.removeprefix("/feather/").split("?")[0]).resolve()
            if not file.is_relative_to(root) or not file.is_file():
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            data = file.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("content-type", mimetypes.guess_type(file.name)[0] or "application/octet-stream")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/api/reply":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        length = int(self.headers.get("content-length", "0"))
        try:
            payload = json.loads(self.rfile.read(length) or b"null")
        except json.JSONDecodeError:
            payload = None
        # Never act on a reply that has not been validated against the experience it answers.
        result = validate_reply(APPROVE, payload)
        if not result.ok:
            self.send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {"issues": format_issues(result.issues)})
            return
        DECISIONS.append(result.reply)
        self.send_json(HTTPStatus.OK, {"reply": result.reply})

    def log_message(self, format: str, *args: object) -> None:  # quiet by default
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Caller)
    print(f"Feather caller on http://localhost:{args.port} (feather-sdk {feather_sdk.__version__})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
