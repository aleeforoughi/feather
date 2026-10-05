from __future__ import annotations

from typing import Any, Iterable

from ._spec import IR_VERSION, UPDATE_VERSION


def experience(
    experience_id: str,
    nodes: Iterable[dict[str, Any]],
    *,
    locale: str | None = None,
    revision: int | None = None,
    resolved: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """An Experience IR document: the next necessary interaction, as meaning.

    `nodes` are the dicts the builders in `feather_sdk.nodes` return, in the order that is the meaning. `revision` is
    the caller's version of it (0, or leave it out, when it is opened; one more with each update). `resolved` is
    `{"outcome", "summary", "artifact"?}` (the dict `feather_sdk.ops.resolve` gives, without its "op") for an
    experience that is already over; its nodes may then be empty. Nothing is validated here;
    `feather_sdk.validate()` does that.
    """
    doc: dict[str, Any] = {"ir": IR_VERSION, "experience": experience_id}
    if locale is not None:
        doc["locale"] = locale
    if revision is not None:
        doc["revision"] = revision
    if resolved is not None:
        doc["resolved"] = resolved
    doc["nodes"] = list(nodes)
    return doc


def update(experience_id: str, revision: int, ops: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """A `feather.update/1`: one change to an open experience, for `apply_update()`.

    `experience_id` names the experience it changes, `revision` is the revision the experience has once the update is
    applied (exactly one more than before), and `ops` are the dicts `feather_sdk.ops` returns: `add`, `replace`,
    `patch`, `remove`, and `resolve` (always last). Every op lands, or none does. Nothing is validated here.
    """
    return {"update": UPDATE_VERSION, "experience": experience_id, "revision": revision, "ops": list(ops)}
