from __future__ import annotations

from typing import Any, Iterable

from ._spec import IR_VERSION


def experience(experience_id: str, nodes: Iterable[dict[str, Any]], *, locale: str | None = None) -> dict[str, Any]:
    """An Experience IR document: the next necessary interaction, as meaning.

    `nodes` are the dicts the builders in `feather_sdk.nodes` return, in the order that is the meaning. Nothing is
    validated here; `feather_sdk.validate()` does that.
    """
    doc: dict[str, Any] = {"ir": IR_VERSION, "experience": experience_id}
    if locale is not None:
        doc["locale"] = locale
    doc["nodes"] = list(nodes)
    return doc
