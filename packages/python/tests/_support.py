import json
import sys
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGE))
CONFORMANCE = PACKAGE.parents[1] / "conformance"


def load_json(path: Path):
    return json.loads(path.read_text("utf-8"))


def fixtures(kind: str):
    return [(p.stem, load_json(p)) for p in sorted((CONFORMANCE / "ir" / kind).glob("*.json"))]


def issue_dict(issue):
    out = {"code": issue.code, "path": issue.path, "message": issue.message}
    if issue.node is not None:
        out["node"] = issue.node
    return out
