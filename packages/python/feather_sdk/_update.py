"""apply_update(): a port of packages/intent/src/update.ts. Same checks, same order, same words."""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any, Callable

from ._js import UNDEF, describe, get, is_array, is_integer, is_number, is_object, js_keys, js_num, quote
from ._spec import MAX_ISSUES, UPDATE_VERSION
from ._validate import _unknown_field, check_resolution, seg, validate

_UPDATE_FIELDS = ["update", "experience", "revision", "ops"]
_OP_FIELDS: dict[str, list[str]] = {
    "add": ["op", "node", "after"],
    "replace": ["op", "node"],
    "patch": ["op", "id", "set"],
    "remove": ["op", "id"],
    "resolve": ["op", "outcome", "summary", "artifact"],
}


@dataclass(frozen=True)
class UpdateIssue:
    """One reason an update was refused: a stable code, a JSON Pointer into the update (under `/result`, into the
    experience the update would make), and a sentence saying what to change."""

    code: str
    path: str
    message: str


@dataclass(frozen=True)
class UpdateResult:
    """`ok` with the new `experience`, or not ok with the `issues`. `stale` is true when one reason is that the
    update's revision is not one more than the experience's: the caller and Feather have drifted, so send the whole
    experience again."""

    ok: bool
    experience: dict[str, Any] | None = None
    issues: list[UpdateIssue] = field(default_factory=list)

    def __bool__(self) -> bool:
        return self.ok

    @property
    def stale(self) -> bool:
        return not self.ok and any(i.code == "stale-revision" for i in self.issues)


class _Overflow(Exception):
    pass


Add = Callable[..., None]


def apply_update(experience: Any, update: Any) -> UpdateResult:
    """Applies a `feather.update/1` (a dict) to an experience (a dict). Returns the new experience, or every reason it
    cannot be applied. Pure: neither argument is changed, and the experience returned shares nothing with them. Every
    op lands or none does, and the result is valid `feather.ir/1`. Never raises."""
    issues: list[UpdateIssue] = []

    def add(code: str, path: str, message: str, node: str | None = None) -> None:
        if len(issues) == MAX_ISSUES:
            issues.append(UpdateIssue("too-many-issues", "", f"More than {MAX_ISSUES} problems; fix these first, then send the update again."))
            raise _Overflow()
        issues.append(UpdateIssue(code, path, message))

    try:
        result = _run(experience, update, add, issues)
        if not issues and result is not None:
            return UpdateResult(True, result, [])
    except _Overflow:
        pass
    except Exception as err:  # noqa: BLE001 - something that is not JSON data
        issues.append(UpdateIssue("unreadable", "", f"The update could not be read as JSON data ({err}); send plain JSON."))
    return UpdateResult(False, None, issues)


def _lower(s: str) -> str:
    return s[:1].lower() + s[1:]


def _run(experience: Any, update: Any, add: Add, issues: list[UpdateIssue]) -> dict[str, Any] | None:
    checked = validate(experience)
    if not checked.ok:
        add(
            "invalid-experience",
            "",
            f"The experience is not valid feather.ir/1 (first: {checked.issues[0].message}); an update applies to a valid experience.",
        )
        return None
    if not is_object(update):
        add("not-an-object", "", f'An update is a JSON object with "update", "experience", "revision" and "ops"; got {describe(update)}.')
        return None
    for key in js_keys(update):
        if key not in _UPDATE_FIELDS:
            _unknown_field(add, seg(key), key, "the update", list(_UPDATE_FIELDS))
    version = get(update, "update")
    if version is UNDEF:
        add("missing-field", "/update", f'Say which format this is: "update": "{UPDATE_VERSION}".')
    elif version != UPDATE_VERSION:
        add("unsupported-version", "/update", f"This Feather reads {UPDATE_VERSION}; the update is {quote(version)}.")
        return None
    target_name = get(update, "experience")
    if target_name != experience["experience"]:
        add("wrong-experience", "/experience", f'The update is for {quote(target_name)}, not "{experience["experience"]}".')
    current = get(experience, "revision")
    nxt = (0 if current is UNDEF else current) + 1
    revision = get(update, "revision")
    if revision is UNDEF:
        add("missing-field", "/revision", f"Give the revision this update makes: {js_num(nxt)}.")
    elif not is_number(revision) or not is_integer(revision):
        add("wrong-type", "/revision", f"revision is a whole number; got {quote(revision)}.")
    elif revision != nxt:
        add(
            "stale-revision",
            "/revision",
            f"The experience is at revision {js_num(nxt - 1)}, so this update must be revision {js_num(nxt)}; got {js_num(revision)}. "
            "Send the whole experience again if the two have drifted apart.",
        )
    resolved = get(experience, "resolved")
    if resolved is not UNDEF:
        add("already-resolved", "", f'"{experience["experience"]}" is resolved ({resolved["outcome"]}); it takes no more updates.')
        return None
    ops = get(update, "ops")
    if ops is UNDEF:
        add("missing-field", "/ops", "An update needs its ops: add, replace, patch, remove or resolve.")
        return None
    if not is_array(ops):
        add("wrong-type", "/ops", f"ops must be an array; got {describe(ops)}.")
        return None
    if len(ops) == 0:
        add("empty-update", "/ops", "An update with no ops changes nothing; send at least one, or no update.")

    # Each op applies to the nodes as the ops before it left them.
    nodes: list[Any] = copy.deepcopy(experience["nodes"])

    def index_of(node_id: Any) -> int:
        if isinstance(node_id, str):
            for i, n in enumerate(nodes):
                if n.get("id") == node_id:
                    return i
        return -1

    resolution: dict[str, Any] | None = None
    resolved_at = -1
    for i, op in enumerate(ops):
        at = f"/ops/{i}"
        if not is_object(op):
            add("not-an-object", at, f'Each op is a JSON object with an "op"; got {describe(op)}.')
            continue
        name = get(op, "op")
        kind = name if isinstance(name, str) and name in _OP_FIELDS else None
        if kind is None:
            add("missing-field" if name is UNDEF else "unknown-op", f"{at}/op", f"op is one of {', '.join(_OP_FIELDS)}; got {quote(name)}.")
            continue
        if resolved_at >= 0:
            add("after-resolve", at, f"Op {i} comes after the resolve at op {resolved_at}; resolve is always the last op.")
            continue
        if kind != "resolve":
            for key in js_keys(op):
                if key not in _OP_FIELDS[kind]:
                    _unknown_field(add, f"{at}{seg(key)}", key, f"a {kind} op", list(_OP_FIELDS[kind]))

        def node_of() -> dict[str, Any] | None:
            node = get(op, "node")
            if node is UNDEF:
                add("missing-field", f"{at}/node", f"A {kind} op carries the node, whole.")
            elif not is_object(node):
                add("wrong-type", f"{at}/node", f"node must be an object; got {describe(node)}.")
            elif not isinstance(get(node, "id"), str):
                add("missing-field", f"{at}/node/id", f"The node of a {kind} op needs its id.")
            else:
                return node
            return None

        def existing() -> int:
            node_id = get(op, "id")
            if node_id is UNDEF:
                add("missing-field", f"{at}/id", f"A {kind} op names the node it changes by its id.")
            elif index_of(node_id) < 0:
                add("unknown-node", f"{at}/id", f"There is no node {quote(node_id)} to {kind}.")
            else:
                return index_of(node_id)
            return -1

        if kind == "add":
            node = node_of()
            if node is None:
                continue
            if index_of(node["id"]) >= 0:
                add("duplicate-id", f"{at}/node/id", f'There is already a node "{node["id"]}"; replace it, or give the new node another id.')
                continue
            after = get(op, "after")
            if after is UNDEF:
                nodes.append(copy.deepcopy(node))
            elif index_of(after) < 0:
                add("unknown-node", f"{at}/after", f"There is no node {quote(after)} to add after.")
            else:
                nodes.insert(index_of(after) + 1, copy.deepcopy(node))
        elif kind == "replace":
            node = node_of()
            if node is None:
                continue
            if index_of(node["id"]) < 0:
                add("unknown-node", f"{at}/node/id", f'There is no node "{node["id"]}" to replace; add it instead.')
            else:
                nodes[index_of(node["id"])] = copy.deepcopy(node)
        elif kind == "patch":
            index = existing()
            changes = get(op, "set")
            if changes is UNDEF:
                add("missing-field", f"{at}/set", "A patch op carries set: the fields that change.")
            elif not is_object(changes):
                add("wrong-type", f"{at}/set", f"set must be an object; got {describe(changes)}.")
            elif len(changes) == 0:
                add("empty-update", f"{at}/set", "set is empty, so the patch changes nothing.")
            else:
                for key in ("id", "type"):
                    if key in changes:
                        add("invalid-value", f"{at}/set{seg(key)}", f"A patch never changes a node's {key}; replace the node, or remove it and add another.")
                if index < 0:
                    continue
                target = nodes[index]
                for key in js_keys(changes):
                    if key in ("id", "type"):
                        continue
                    if changes[key] is None:
                        target.pop(key, None)
                    else:
                        target[key] = copy.deepcopy(changes[key])
        elif kind == "remove":
            index = existing()
            if index >= 0:
                del nodes[index]
        else:  # resolve
            before = len(issues)
            check_resolution(add, op, at, "The resolve op", ("op",))
            resolved_at = i
            if len(issues) == before:
                resolution = {"outcome": op["outcome"], "summary": op["summary"]}
                if get(op, "artifact") is not UNDEF:
                    resolution["artifact"] = copy.deepcopy(op["artifact"])

    # An update already refused is not also judged by what it would have made.
    if issues:
        return None
    result: dict[str, Any] = copy.deepcopy(experience)
    result["revision"] = update["revision"]
    result["nodes"] = nodes
    if resolution is not None:
        result["resolved"] = resolution
    valid = validate(result)
    if not valid.ok:
        for issue in valid.issues:
            add(issue.code, f"/result{issue.path}", f"After the update, {_lower(issue.message)}")
        return None
    return result
