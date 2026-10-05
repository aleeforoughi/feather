"""Builders for the ops of an update (`feather.update/1`), for `feather_sdk.update()`. Like `feather_sdk.nodes`, they
return plain dicts, drop `None`, and validate nothing; `apply_update()` does that.

    from feather_sdk import nodes, ops, update

    change = update("plan_trip", 2, [
        ops.patch("work", value=1),
        ops.add(nodes.Text(id="t", text="Found one.")),
        ops.resolve("done", "Booked: direct flight, 9:40.", artifact={"label": "Booking", "kind": "document"}),
    ])
"""

from __future__ import annotations

from typing import Any

__all__ = ["add", "patch", "remove", "replace", "resolve"]


def add(node: dict[str, Any], *, after: str | None = None) -> dict[str, Any]:
    """Adds `node` after the node whose id is `after`, or at the end. Its id must be new."""
    op: dict[str, Any] = {"op": "add", "node": node}
    if after is not None:
        op["after"] = after
    return op


def replace(node: dict[str, Any]) -> dict[str, Any]:
    """Puts `node`, whole, in place of the node with its id."""
    return {"op": "replace", "node": node}


def patch(id: str, changes: dict[str, Any] | None = None, /, **fields: Any) -> dict[str, Any]:  # noqa: A002
    """Changes fields of the node `id` in place. Give them as a dict, as keyword arguments, or both; a field set to
    `None` is removed from the node. Never `id` or `type` (to change those, `replace`, or `remove` and `add`)."""
    return {"op": "patch", "id": id, "set": {**(changes or {}), **fields}}


def remove(id: str) -> dict[str, Any]:  # noqa: A002
    """Removes the node `id`."""
    return {"op": "remove", "id": id}


def resolve(outcome: str, summary: str, *, artifact: dict[str, Any] | None = None) -> dict[str, Any]:
    """Ends the experience: `outcome` is "done", "cancelled" or "failed"; `summary` says what happened in one line
    (at most 120 characters) and is all that stays; `artifact` is `{"label", "href"?, "kind"?}`, what it leaves behind.
    Always the last op of an update."""
    op: dict[str, Any] = {"op": "resolve", "outcome": outcome, "summary": summary}
    if artifact is not None:
        op["artifact"] = artifact
    return op
