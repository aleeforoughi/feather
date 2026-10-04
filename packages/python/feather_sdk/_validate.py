"""validate(): a port of packages/intent/src/validate.ts. Same checks, same order, same words."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Callable

from ._js import (
    UNDEF,
    chars,
    describe,
    get,
    includes,
    is_array,
    is_finite,
    is_integer,
    is_number,
    is_object,
    is_scalar,
    js_keys,
    js_num,
    key_of,
    num,
    quote,
    trim,
    u16,
)
from ._spec import (
    DEFAULT_MAX_LENGTH,
    IR_VERSION,
    MAX_ISSUES,
    NODE_SPECS,
    PRESENTATIONAL_FIELDS,
    fields_of,
    spec_for,
)

_ID = re.compile(r"[A-Za-z][A-Za-z0-9_.-]{0,63}")
_LOCALE = re.compile(r"[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*")
_CURRENCY = re.compile(r"[A-Z]{3}")
_ISO_DATE = re.compile(r"([0-9]{4})-([0-9]{2})-([0-9]{2})(?:T([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.[0-9]+)?)?(Z|[+-][0-9]{2}:[0-9]{2})?)?")
_TOP_LEVEL = ["ir", "experience", "locale", "nodes"]
_IMPORTANCE = ["low", "normal", "high", "critical"]


@dataclass(frozen=True)
class Issue:
    """One problem: a stable code, a JSON Pointer to where it is, a sentence saying what to change."""

    code: str
    path: str
    message: str
    node: str | None = None


@dataclass(frozen=True)
class ValidationResult:
    """`ok` with the `experience` (the dict, as given), or not ok with the `issues`."""

    ok: bool
    experience: dict[str, Any] | None = None
    issues: list[Issue] = field(default_factory=list)

    def __bool__(self) -> bool:
        return self.ok


class _Overflow(Exception):
    pass


Add = Callable[..., None]


@dataclass
class _Entry:
    node: dict[str, Any]
    spec: dict[str, Any]
    index: int
    id: str | None
    name: str
    at: str


def seg(p: str | int) -> str:
    """One JSON Pointer segment, escaped (RFC 6901)."""
    if isinstance(p, int):
        return f"/{p}"
    return "/" + p.replace("~", "~0").replace("/", "~1")


def _pointer(*parts: str | int) -> str:
    return "".join(seg(p) for p in parts)


def _lower(s: str) -> str:
    return s[:1].lower() + s[1:]


def _range(lo: Any, hi: Any) -> str:
    if lo is not None and hi is not None:
        return f"between {js_num(lo)} and {js_num(hi)}"
    return f"at least {js_num(lo)}" if lo is not None else f"at most {js_num(hi)}"


def validate(document: Any) -> ValidationResult:
    """Validates a feather.ir/0 document (a dict, or a JSON string). Never raises."""
    if isinstance(document, (str, bytes, bytearray)):
        try:
            text = document.decode("utf-8") if not isinstance(document, str) else document
            document = json.loads(text, parse_constant=_reject_constant)
        except Exception as err:  # noqa: BLE001 - anything unreadable is reported, never raised
            return ValidationResult(False, None, [Issue("unreadable", "", f"The document could not be read as JSON data ({err}); send plain JSON.")])
    issues: list[Issue] = []

    def add(code: str, path: str, message: str, node: str | None = None) -> None:
        if len(issues) == MAX_ISSUES:
            issues.append(Issue("too-many-issues", "", f"More than {MAX_ISSUES} problems; fix these first, then validate again."))
            raise _Overflow()
        issues.append(Issue(code, path, message, node))

    try:
        _run(document, add)
    except _Overflow:
        pass
    except Exception as err:  # noqa: BLE001
        issues.append(Issue("unreadable", "", f"The document could not be read as JSON data ({err}); send plain JSON."))
    if not issues:
        return ValidationResult(True, document, [])
    return ValidationResult(False, None, issues)


def _reject_constant(name: str) -> Any:
    raise ValueError(f"{name} is not JSON")


def _run(doc: Any, add: Add) -> None:
    if not is_object(doc):
        add("not-an-object", "", f'An experience is a JSON object with "ir", "experience" and "nodes"; got {describe(doc)}.')
        return

    for key in js_keys(doc):
        if key not in _TOP_LEVEL:
            _unknown_field(add, _pointer(key), key, "the experience", list(_TOP_LEVEL))
    ir = get(doc, "ir")
    if ir is UNDEF:
        add("missing-field", "/ir", f'Say which IR this is: "ir": "{IR_VERSION}".')
    elif not isinstance(ir, str):
        add("wrong-type", "/ir", f'ir must be the string "{IR_VERSION}"; got {describe(ir)}.')
        return
    elif ir != IR_VERSION:
        add("unsupported-version", "/ir", f"This Feather reads {IR_VERSION}; the document is {quote(ir)}.")
        return
    experience = get(doc, "experience")
    if experience is UNDEF:
        add("missing-field", "/experience", 'Name the experience ("experience": "approve_campaign"); replies carry the name back.')
    elif not isinstance(experience, str) or not _ID.fullmatch(experience):
        add("invalid-id", "/experience", f'The experience name must start with a letter and use letters, digits, "_", "." or "-" (at most 64); got {quote(experience)}.')
    locale = get(doc, "locale")
    if locale is not UNDEF and (not isinstance(locale, str) or not _LOCALE.fullmatch(locale)):
        add("invalid-value", "/locale", f'locale must be a BCP 47 language tag such as "en" or "ar-AE"; got {quote(locale)}.')
    nodes = get(doc, "nodes")
    if nodes is UNDEF:
        add("missing-field", "/nodes", "An experience needs its nodes: the interaction, as meaning.")
        return
    if not is_array(nodes):
        add("wrong-type", "/nodes", f"nodes must be an array; got {describe(nodes)}.")
        return
    if len(nodes) == 0:
        add("empty-experience", "/nodes", "An experience with no nodes renders nothing; send at least one node, or no experience.")

    entries: list[_Entry] = []
    by_id: dict[str, _Entry] = {}
    for index, node in enumerate(nodes):
        at = _pointer("nodes", index)
        if not is_object(node):
            add("not-an-object", at, f'Each node is a JSON object with a "type" and an "id"; got {describe(node)}.')
            continue
        raw_id = get(node, "id")
        nid = raw_id if isinstance(raw_id, str) else None
        if get(node, "type") is UNDEF:
            label = f' ("{nid}")' if nid else ""
            add("missing-field", f"{at}/type", f'Node {index}{label} needs a "type".', nid)
            continue
        spec = spec_for(node["type"])
        if spec is None:
            guess = _closest(node["type"], list(NODE_SPECS)) if isinstance(node["type"], str) else None
            add("unknown-node-type", f"{at}/type", f'{quote(node["type"])} is not a feather.ir/0 node type{f"; did you mean {guess}?" if guess else "."}', nid)
            continue
        name = f'{spec["type"]} "{nid}"' if nid else f'{spec["type"]} at {at}'
        entry = _Entry(node, spec, index, nid, name, at)
        entries.append(entry)
        fields = fields_of(spec)

        for key in js_keys(node):
            if key == "type" or key in fields:
                continue
            if key == "primary":
                if node["primary"] is not False:
                    add("not-primary-capable", f"{at}{seg(key)}", f"{name} cannot be the primary act; only Action, Choice, Input, Form, Approval, Recommendation and IrreversibleAction can.", nid)
            else:
                _unknown_field(add, f"{at}{seg(key)}", key, name, ["type", *fields], nid)
        if spec["act"] and get(node, "intent") is UNDEF:
            add("missing-field", f"{at}/intent", f"{name} is an act, so it needs an intent: what the person is doing, in a few words.", nid)
        if spec["type"] == "IrreversibleAction" and get(node, "consequence") is UNDEF:
            add(
                "irreversible-without-consequence",
                f"{at}/consequence",
                f"{name} cannot be undone, so it must state its consequence exactly (spend, publish, send, consent, delete or a statement). Principle 6: irreversible means explicit.",
                nid,
            )
        for key, fld in fields.items():
            if spec["type"] == "IrreversibleAction" and key == "consequence" and get(node, "consequence") is UNDEF:
                continue
            _check_field(add, get(node, key), fld, f"{at}{seg(key)}", key, name, nid)
        if spec["type"] != "IrreversibleAction" and get(node, "consequence") is not UNDEF and node.get("reversible") is True:
            add(
                "irreversible-marked-reversible",
                f"{at}/reversible",
                f'{name} states a consequence, and an act with a consequence to state cannot be undone (principle 6); drop "reversible": true, or drop the consequence.',
                nid,
            )
        importance = get(node, "importance")
        if spec.get("importance") and isinstance(importance, str) and importance in _IMPORTANCE and importance not in spec["importance"]:
            add("invalid-value", f"{at}/importance", f'{name} cannot be undone, so its importance is {" or ".join(spec["importance"])}, never {importance}.', nid)

        if nid is not None:
            if not _ID.fullmatch(nid):
                add("invalid-id", f"{at}/id", f'Node ids start with a letter and use letters, digits, "_", "." or "-" (at most 64); got {quote(nid)}.', nid)
            first = by_id.get(nid)
            if first:
                add("duplicate-id", f"{at}/id", f'Two nodes are called "{nid}" (nodes {first.index} and {index}); ids must be unique so replies reach the right one.', nid)
            else:
                by_id[nid] = entry

    # ── Across nodes ──
    for entry in entries:
        _check_references(add, entry, by_id)
    predictions: dict[str, list[_Entry]] = {}
    for e in entries:
        if e.spec["type"] == "PredictedChoice" and isinstance(e.node.get("of"), str):
            predictions.setdefault(e.node["of"], []).append(e)
    recommendations = sum(1 for e in entries if e.spec["type"] == "Recommendation")
    for entry in entries:
        _check_node(add, entry, by_id, predictions, recommendations)

    primaries = [e for e in entries if e.spec["primaryCapable"] and e.node.get("primary") is True]
    for extra in primaries[1:]:
        add("multiple-primary", f"{extra.at}/primary", f"An experience has one primary act; {primaries[0].name} already is, so {extra.name} cannot also be.", extra.id)

    confirmers = [e for e in entries if e.spec["type"] == "IrreversibleAction"]
    confirmed = {e.node["confirms"] for e in confirmers if isinstance(e.node.get("confirms"), str)}
    implicit = len(confirmers) == 1 and get(confirmers[0].node, "confirms") is UNDEF
    for e in entries:
        node, spec = e.node, e.spec
        if spec["type"] == "IrreversibleAction" or not spec["act"] or node.get("reversible") is not False or get(node, "consequence") is not UNDEF:
            continue
        if implicit or (e.id is not None and e.id in confirmed):
            continue
        how = "Give it a consequence, or confirm it" if "consequence" in spec["fields"] else "Confirm it"
        add(
            "irreversible-without-consequence",
            f"{e.at}/reversible",
            f'{e.name} cannot be undone, but nothing states what it does. {how} with an IrreversibleAction whose "confirms" is "{e.id if e.id is not None else "its id"}" (principle 6: irreversible means explicit).',
            e.id,
        )


def _unknown_field(add: Add, path: str, key: str, where: str, known: list[str], node: str | None = None) -> None:
    if key in PRESENTATIONAL_FIELDS:
        add("presentational-field", path, f'"{key}" describes presentation; {where} carries meaning only, and Feather decides how it looks (principle 1: semantics, not pixels).', node)
    else:
        guess = _closest(key, known)
        hint = f'; did you mean "{guess}"?' if guess else "."
        add("unknown-field", path, f"{where} has no field {quote(key)}{hint}", node)


def _check_field(add: Add, value: Any, fld: dict[str, Any], path: str, key: str, where: str, node: str | None) -> None:
    kind = fld["kind"]
    if value is UNDEF:
        if fld.get("required"):
            add("missing-field", path, f'{where} needs "{key}": {_lower(fld["doc"])}', node)
        return

    def wrong(expected: str) -> None:
        add("wrong-type", path, f"{where}.{key} must be {expected}; got {describe(value)}.", node)

    def too_long(s: str, limit: int) -> None:
        if chars(s) > limit:
            add("too-long", path, f"{where}.{key} is {chars(s)} characters; keep it to {limit}.", node)

    if kind in ("string", "ref", "id"):
        if not isinstance(value, str):
            return wrong("a string")
        if trim(value) == "":
            return add("empty-text", path, f"{where}.{key} is empty.", node)
        if kind == "id" and not _ID.fullmatch(value):
            return add("invalid-id", path, f'{where}.{key} must start with a letter and use letters, digits, "_", "." or "-" (at most 64); got {quote(value)}.', node)
        return too_long(value, fld.get("maxLength", DEFAULT_MAX_LENGTH) if kind == "string" else 64)
    if kind == "text-or-number":
        if isinstance(value, str):
            return too_long(value, DEFAULT_MAX_LENGTH)
        if not is_finite(value):
            wrong("a string or a number")
        return
    if kind == "number":
        if not is_finite(value):
            return wrong("a number")
        v = num(value)
        if fld.get("integer") and not v.is_integer():
            return add("invalid-value", path, f"{where}.{key} must be a whole number; got {js_num(value)}.", node)
        lo, hi = fld.get("min"), fld.get("max")
        if (lo is not None and v < lo) or (hi is not None and v > hi):
            add("out-of-range", path, f"{where}.{key} must be {_range(lo, hi)}; got {js_num(value)}.", node)
        return
    if kind == "boolean":
        if not isinstance(value, bool):
            wrong("true or false")
        return
    if kind == "enum":
        if not isinstance(value, str) or value not in fld["values"]:
            add("invalid-value", path, f'{where}.{key} must be one of {", ".join(fld["values"])}; got {quote(value)}.', node)
        return
    if kind == "currency":
        if not isinstance(value, str) or not _CURRENCY.fullmatch(value):
            add("invalid-currency", path, f"{where}.{key} must be an ISO 4217 currency code, three capital letters such as AED or USD; got {quote(value)}.", node)
        return
    if kind == "date":
        if not isinstance(value, str) or not parse_date(value):
            add("invalid-date", path, f"{where}.{key} must be an ISO 8601 date or date-time such as 2026-10-03 or 2026-10-03T14:00:00+04:00; got {quote(value)}.", node)
        return
    if kind == "scalar":
        if not is_scalar(value):
            return wrong("a string, number or boolean")
        if isinstance(value, str):
            too_long(value, DEFAULT_MAX_LENGTH)
        return
    if kind in ("refs", "strings", "scalars"):
        if not is_array(value):
            return wrong("an array")

        def ok(v: Any) -> bool:
            if kind == "scalars":
                return is_scalar(v)
            return isinstance(v, str) and trim(v) != "" and chars(v) <= DEFAULT_MAX_LENGTH

        for i, v in enumerate(value):
            if not ok(v):
                expected = "a string, number or boolean" if kind == "scalars" else f"a non-empty string of at most {DEFAULT_MAX_LENGTH} characters"
                add("wrong-type", f"{path}/{i}", f"{where}.{key}[{i}] must be {expected}; got {describe(v)}.", node)
        if fld.get("minItems") and len(value) < fld["minItems"]:
            add("too-few-items", path, f"{where}.{key} needs at least {fld['minItems']}; it has {len(value)}.", node)
        if kind == "refs" and fld.get("unique"):
            seen: set[Any] = set()
            for i, v in enumerate(value):
                k = key_of(v)
                if k in seen:
                    add("duplicate-item", f"{path}/{i}", f"{where}.{key} lists {quote(v)} twice.", node)
                seen.add(k)
        return
    if kind == "array":
        if not is_array(value):
            return wrong("an array")
        if fld.get("minItems") and len(value) < fld["minItems"]:
            add("too-few-items", path, f"{where}.{key} needs at least {fld['minItems']}; it has {len(value)}.", node)
        for i, item in enumerate(value):
            _check_object(add, item, fld["of"], f"{path}/{i}", f"{where}.{key}[{i}]", node, False)
        return
    if kind == "object":
        _check_object(add, value, fld["fields"], path, f"{where}.{key}", node, fld.get("atLeastOne", False), key)
        return
    if kind == "record":
        if not is_object(value):
            return wrong("an object")
        for k in js_keys(value):
            if not is_scalar(value[k]):
                add("wrong-type", f"{path}{seg(k)}", f"{where}.{key}.{k} must be a string, number or boolean; got {describe(value[k])}.", node)
        return
    raise ValueError(f"unknown field kind {kind}")


def _check_object(add: Add, value: Any, fields: dict[str, Any], path: str, where: str, node: str | None, at_least_one: bool, key: str | None = None) -> None:
    if not is_object(value):
        return add("wrong-type", path, f"{where} must be an object; got {describe(value)}.", node)
    for k in js_keys(value):
        if k not in fields:
            _unknown_field(add, f"{path}{seg(k)}", k, where, list(fields), node)
    if at_least_one and not any(k in value for k in fields):
        code = "empty-consequence" if key == "consequence" else "empty-expandable"
        add(code, path, f'{where} is empty; give at least one of {", ".join(fields)}.', node)
    for k, f in fields.items():
        _check_field(add, get(value, k), f, f"{path}{seg(k)}", k, where, node)


def _check_references(add: Add, e: _Entry, by_id: dict[str, _Entry]) -> None:
    node, spec = e.node, e.spec
    for key, fld in spec["fields"].items():
        if fld["kind"] not in ("ref", "refs"):
            continue
        value = get(node, key)
        refs: list[tuple[str, str]] = []
        if fld["kind"] == "ref":
            if isinstance(value, str) and trim(value) != "":
                refs = [(value, f"{e.at}{seg(key)}")]
        elif is_array(value):
            refs = [(v, f"{e.at}{seg(key)}/{i}") for i, v in enumerate(value) if isinstance(v, str) and trim(v) != ""]
        for ref, path in refs:
            target = by_id.get(ref)
            if ref == e.id:
                add("self-reference", path, f"{e.name} refers to itself in {key}.", e.id)
            elif target is None:
                add("dangling-reference", path, f"{e.name} refers to {quote(ref)} in {key}, but no node has that id.", e.id)
            elif fld.get("to") and target.spec["type"] not in fld["to"]:
                head, sep, tail = ", ".join(fld["to"]).rpartition(", ")
                listed = f"{head} or {tail}" if sep else tail
                add("wrong-reference-type", path, f'{e.name}.{key} must point at a {listed}; "{ref}" is a {target.spec["type"]}.', e.id)


def _option_ids(node: dict[str, Any]) -> list[str]:
    options = node.get("options")
    if not is_array(options):
        return []
    return [o["id"] for o in options if is_object(o) and isinstance(o.get("id"), str)]


def _check_node(add: Add, e: _Entry, by_id: dict[str, _Entry], predictions_of: dict[str, list[_Entry]], recommendations: int) -> None:
    node, spec, at, name, nid, index = e.node, e.spec, e.at, e.name, e.id, e.index
    t = spec["type"]
    if t == "Choice":
        ids = _option_ids(node)
        seen: set[str] = set()
        for i, o in enumerate(ids):
            if o in seen:
                add("duplicate-option", f"{at}/options/{i}/id", f'{name} has two options called "{o}".', nid)
            seen.add(o)
        selected = [s for s in node["selected"] if isinstance(s, str)] if is_array(node.get("selected")) else []
        for i, s in enumerate(selected):
            if s not in seen:
                add("unknown-option", f"{at}/selected/{i}", f'{name} marks {quote(s)} selected, but it has no such option ({", ".join(ids)}).', nid)
        if node.get("multiple") is not True and len(selected) > 1:
            add("too-many-selected", f"{at}/selected", f'{name} allows one pick but marks {len(selected)} selected; set "multiple": true or select one.', nid)
        if nid is None:
            return
        preds = predictions_of.get(nid, [])
        for extra in preds[1:]:
            add("conflicting-prediction", f"{extra.at}/of", f"{name} already has a prediction ({preds[0].name}); a Choice has at most one, or its preselection would be ambiguous.", extra.id)
        first = preds[0] if preds else None
        if first and len(selected) > 0 and isinstance(first.node.get("option"), str) and first.node["option"] in seen and first.node["option"] not in selected:
            add(
                "conflicting-prediction",
                f"{first.at}/option",
                f'{first.name} predicts "{first.node["option"]}", but {name} already has {", ".join(selected)} selected; drop the prediction or make them agree.',
                first.id,
            )
    elif t == "Input":
        lo, hi = node.get("min"), node.get("max")
        if is_number(lo) and is_number(hi) and num(lo) > num(hi):
            add("out-of-range", f"{at}/min", f"{name} accepts nothing: min {js_num(lo)} is above max {js_num(hi)}.", nid)
        if node.get("kind") == "money" and get(node, "currency") is UNDEF:
            add("missing-field", f"{at}/currency", f"{name} asks for money, so it needs a currency.", nid)
    elif t == "Form":
        # Each field is asked as an Input is, so it obeys the same rules; its id is the key of its answer.
        seen_fields: set[str] = set()
        fields = node.get("fields")
        for i, fld in enumerate(fields if is_array(fields) else []):
            if not is_object(fld):
                continue
            fid = fld.get("id")
            label = f'{name}, field {chr(34) + fid + chr(34) if isinstance(fid, str) else i}'
            if isinstance(fid, str):
                if fid in seen_fields:
                    add("duplicate-field", f"{at}/fields/{i}/id", f'{name} has two fields called "{fid}"; each answer is keyed by its field id.', nid)
                seen_fields.add(fid)
            lo, hi = fld.get("min"), fld.get("max")
            if is_number(lo) and is_number(hi) and num(lo) > num(hi):
                add("out-of-range", f"{at}/fields/{i}/min", f"{label} accepts nothing: min {js_num(lo)} is above max {js_num(hi)}.", nid)
            if fld.get("kind") == "money" and get(fld, "currency") is UNDEF:
                add("missing-field", f"{at}/fields/{i}/currency", f"{label} asks for money, so it needs a currency.", nid)
    elif t == "Date":
        start = parse_date(node["value"]) if isinstance(node.get("value"), str) else None
        end = parse_date(node["until"]) if isinstance(node.get("until"), str) else None
        if start and end and start[1] == end[1] and end[0] < start[0]:
            add("out-of-range", f"{at}/until", f'{name} ends ({node["until"]}) before it starts ({node["value"]}).', nid)
    elif t == "Progress":
        seen_steps: set[str] = set()
        steps = node.get("steps")
        for i, step in enumerate(steps if is_array(steps) else []):
            sid = step.get("id") if is_object(step) else None
            if not isinstance(sid, str):
                continue
            if sid in seen_steps:
                add("duplicate-step", f"{at}/steps/{i}/id", f'{name} has two steps called "{sid}".', nid)
            seen_steps.add(sid)
    elif t == "Media":
        reach = "every medium needs a text equivalent so it reaches people who cannot see or hear it"
        kind = node.get("kind")
        if kind in ("image", "video") and get(node, "alt") is UNDEF:
            add("missing-text-equivalent", f"{at}/alt", f'{name} is {"an image" if kind == "image" else "a video"} without alt text saying what it shows; {reach}.', nid)
        if kind == "audio" and get(node, "transcript") is UNDEF:
            add("missing-text-equivalent", f"{at}/transcript", f"{name} is audio without a transcript; {reach}.", nid)
        if kind == "video" and get(node, "transcript") is UNDEF and get(node, "captions") is UNDEF:
            add("missing-text-equivalent", f"{at}/captions", f"{name} is a video without captions or a transcript; {reach}.", nid)
    elif t == "PredictedChoice":
        choice = by_id.get(node["of"]) if isinstance(node.get("of"), str) else None
        option = node.get("option")
        if choice and choice.spec["type"] == "Choice" and isinstance(option, str) and option not in _option_ids(choice.node):
            add("unknown-option", f"{at}/option", f'{name} predicts {quote(option)}, but {choice.name} has no such option ({", ".join(_option_ids(choice.node))}).', nid)
    elif t == "Alternative":
        target = by_id.get(node["for"]) if isinstance(node.get("for"), str) else None
        if target and target.index > index:
            add("out-of-order", f"{at}/for", f"{name} comes before {target.name}, the node it is an alternative to; the order is meaning, so put the alternative after it.", nid)
        if get(node, "for") is UNDEF and recommendations > 1:
            add("ambiguous-alternative", f"{at}/for", f'{name} must say which recommendation it is an alternative to ("for"), since the experience has several.', nid)
    elif t == "Tradeoff":

        def count(k: str) -> int:
            v = node.get(k)
            return len(v) if is_array(v) else 0

        if count("gains") + count("costs") == 0:
            add("empty-tradeoff", at, f"{name} names no gains and no costs; a tradeoff needs at least one.", nid)
    elif t == "Comparison":
        items = [v for v in node["items"] if isinstance(v, str)] if is_array(node.get("items")) else []
        criteria = node.get("criteria")
        for i, criterion in enumerate(criteria if is_array(criteria) else []):
            if not is_object(criterion) or not is_object(criterion.get("values")):
                continue
            keys = js_keys(criterion["values"])
            missing = list(dict.fromkeys(item for item in items if item not in keys))
            extra = [k for k in keys if k not in items]
            if missing or extra:
                tail = f"; missing {', '.join(missing)}" if missing else ""
                tail += f"; {', '.join(extra)} {'is' if len(extra) == 1 else 'are'} not compared" if extra else ""
                add("comparison-mismatch", f"{at}/criteria/{i}/values", f"{name}: criterion {quote(get(criterion, 'label'))} must give one value per item{tail}.", nid)
    elif t == "Preference":
        options = node.get("options")
        if is_array(options) and is_scalar(node.get("value")) and not includes(list(options), node["value"]):
            add("unknown-option", f"{at}/value", f"{name}'s value {quote(node['value'])} is not one of its options ({', '.join(quote(o) for o in options)}).", nid)
    elif t == "IrreversibleAction":
        if node.get("reversible") is True:
            add("irreversible-marked-reversible", f"{at}/reversible", f'{name} is irreversible by definition; drop "reversible": true, or use an Action if it can be undone.', nid)
        if isinstance(node.get("confirms"), str):
            target = by_id.get(node["confirms"])
            if target and target.spec["type"] != "IrreversibleAction" and target.node.get("reversible") is not False and get(target.node, "consequence") is UNDEF:
                add(
                    "unneeded-confirmation",
                    f"{at}/confirms",
                    f'{name} confirms {target.name}, which can be undone; only an act marked "reversible": false, or stating a consequence, needs confirming.',
                    nid,
                )


def format_issues(issues: Any) -> str:
    """Formats issues for people: one line each, with the path and the code."""
    lines = []
    for i in issues:
        code, message = (i.code, i.message) if hasattr(i, "code") else (i["code"], i["message"])
        path = getattr(i, "path", None) if hasattr(i, "code") else i.get("path")
        prefix = "" if path is None else f"{path or '(document)'}: "
        lines.append(f"- {prefix}{message} [{code}]")
    return "\n".join(lines)


def parse_date(value: str) -> tuple[int, bool] | None:
    """Parses an ISO 8601 date or date-time: (milliseconds, zoned). A wall-clock time is read as UTC."""
    m = _ISO_DATE.fullmatch(value)
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    h, mi, s = int(m.group(4) or 0), int(m.group(5) or 0), int(m.group(6) or 0)
    if mo < 1 or mo > 12 or d < 1 or d > 31 or h > 23 or mi > 59 or s > 59:
        return None
    leap = y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)
    if d > [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]:
        return None
    zone = m.group(7)
    offset = 0
    if zone and zone != "Z":
        oh, om = int(zone[1:3]), int(zone[4:6])
        if oh > 23 or om > 59:
            return None
        offset = (1 if zone[0] == "+" else -1) * (oh * 60 + om)
    # Days since 1970-01-01 in the proleptic Gregorian calendar (Howard Hinnant's algorithm).
    yy = y - (1 if mo <= 2 else 0)
    era = yy // 400
    yoe = yy - era * 400
    doy = (153 * (mo + (-3 if mo > 2 else 9)) + 2) // 5 + d - 1
    doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
    days = era * 146097 + doe - 719468
    return (days * 86_400_000 + h * 3_600_000 + (mi - offset) * 60_000 + s * 1000, zone is not None)


def _closest(word: str, known: list[str]) -> str | None:
    """The known name closest to a misspelling, if close enough to be a likely typo. Long words get no guess."""
    n = len(u16(word)) // 2
    if n > 64:
        return None
    best: str | None = None
    best_distance = float("inf")
    w = _units(word.lower())
    for k in known:
        d = _distance(w, _units(k.lower()))
        if d < best_distance:
            best, best_distance = k, d
    return best if best is not None and best_distance <= max(2, n // 4) else None


def _units(s: str) -> list[int]:
    b = u16(s)
    return [b[i] | (b[i + 1] << 8) for i in range(0, len(b), 2)]


def _distance(a: list[int], b: list[int]) -> int:
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        row = [i]
        for j in range(1, len(b) + 1):
            row.append(min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (0 if a[i - 1] == b[j - 1] else 1)))
        prev = row
    return prev[len(b)]
