"""The browser bundle (packages/embed) that ships inside the wheel, so the server and the page are one version."""

from __future__ import annotations

from pathlib import Path

_STATIC = Path(__file__).resolve().parent / "static"


def static_dir() -> str:
    """The folder holding feather-embed.js, feather-embed.css and its fonts. Serve it as static files, for example
    `app.mount("/feather", StaticFiles(directory=feather_sdk.static_dir()))`, and import
    `/feather/feather-embed.js` in the page.

    Raises FileNotFoundError in a source checkout where the bundle was not built into the package
    (`pnpm build:wheel` does it); an installed wheel always has it.
    """
    if not (_STATIC / "feather-embed.js").is_file():
        raise FileNotFoundError(
            f"The Feather browser bundle is not in {_STATIC}. Install the feather-sdk wheel from a Feather release, "
            "or run `pnpm build:wheel` in the Feather repository."
        )
    return str(_STATIC)
