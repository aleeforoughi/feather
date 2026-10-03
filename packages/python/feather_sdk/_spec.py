"""The node table (generated into _spec.json from packages/intent/src/spec.ts), loaded once."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_RAW: dict[str, Any] = json.loads((Path(__file__).with_name("_spec.json")).read_text(encoding="utf-8"))

IR_VERSION: str = _RAW["irVersion"]
DEFAULT_MAX_LENGTH: int = _RAW["defaultMaxLength"]
MAX_ISSUES: int = _RAW["maxIssues"]
ISSUE_CODES: tuple[str, ...] = tuple(_RAW["issueCodes"])
REPLY_ISSUE_CODES: tuple[str, ...] = tuple(_RAW["replyIssueCodes"])
PRESENTATIONAL_FIELDS: frozenset[str] = frozenset(_RAW["presentationalFields"])
COMMON_FIELDS: dict[str, dict[str, Any]] = _RAW["commonFields"]
PRIMARY_FIELD: dict[str, Any] = _RAW["primaryField"]
NODES: list[dict[str, Any]] = _RAW["nodes"]
NODE_SPECS: dict[str, dict[str, Any]] = {n["type"]: n for n in NODES}

_FIELDS: dict[str, dict[str, dict[str, Any]]] = {}


def spec_for(type_: Any) -> dict[str, Any] | None:
    return NODE_SPECS.get(type_) if isinstance(type_, str) else None


def fields_of(spec: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Every field a node of this type may have, in the order the TypeScript table gives them."""
    fields = _FIELDS.get(spec["type"])
    if fields is None:
        fields = {**COMMON_FIELDS, **({"primary": PRIMARY_FIELD} if spec["primaryCapable"] else {}), **spec["fields"]}
        _FIELDS[spec["type"]] = fields
    return fields
