"""validate_reply(): a port of packages/intent/src/reply.ts."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from ._js import (
    UNDEF,
    WS_CLASS,
    chars,
    get,
    includes,
    is_array,
    is_finite,
    is_object,
    is_scalar,
    js_keys,
    js_num,
    key_of,
    num,
    short,
    stringify,
    trim,
    url_can_parse,
)
from ._spec import spec_for
from ._validate import parse_date, validate

_REPLY_FIELDS = ("experience", "node", "act", "value")
_EMAIL = re.compile(rf"[^@{WS_CLASS}]+@[^@{WS_CLASS}]+\.[^@{WS_CLASS}]+")
_PHONE = re.compile(r"\+?[0-9 ()./-]{3,32}")
_CURRENCY = re.compile(r"[A-Z]{3}")


@dataclass(frozen=True)
class ReplyIssue:
    code: str
    message: str


@dataclass(frozen=True)
class ReplyResult:
    """`ok` with the `reply`, or not ok with the `issues`."""

    ok: bool
    reply: dict[str, Any] | None = None
    issues: list[ReplyIssue] = field(default_factory=list)

    def __bool__(self) -> bool:
        return self.ok


def acts_for(node: dict[str, Any]) -> list[str]:
    """The acts a node takes, in the order the spec lists them."""
    spec = spec_for(node.get("type"))
    acts = list(spec["acts"]) if spec else []
    if node.get("type") == "Warning":
        return acts if node.get("acknowledge") is True else []
    if node.get("type") == "Input" and node.get("required") is True:
        return [a for a in acts if a != "skip"]
    if node.get("type") == "Form" and any(f.get("required") is True for f in node["fields"]):
        return [a for a in acts if a != "skip"]
    return acts


def _fail(code: str, message: str) -> ReplyResult:
    return ReplyResult(False, None, [ReplyIssue(code, message)])


def validate_reply(experience: Any, reply: Any) -> ReplyResult:
    """Checks that a reply answers this experience: the node exists, takes the act, and the value is encoded as the act
    requires. The experience is validated first, so this is safe to call with whatever the caller sent. Never raises."""
    try:
        return _validate_reply(experience, reply)
    except Exception as err:  # noqa: BLE001 - something that is not JSON data (a set, an object() ...)
        return _fail("not-an-object", f"The reply could not be read as JSON data ({err}); send plain JSON: {{ experience, node, act, value? }}.")


def _validate_reply(experience: Any, reply: Any) -> ReplyResult:
    checked = validate(experience)
    if not checked.ok:
        n = len(checked.issues)
        return _fail(
            "invalid-experience",
            f"The experience is not valid feather.ir/0 ({n} problem{'' if n == 1 else 's'}, first: {checked.issues[0].message}); validate it before taking replies.",
        )
    exp = checked.experience
    assert exp is not None
    if get(exp, "resolved") is not UNDEF:
        return _fail("resolved", f'"{exp["experience"]}" is resolved ({exp["resolved"]["outcome"]}); it takes no more replies.')
    if not is_object(reply):
        return _fail("not-an-object", "A reply is a JSON object: { experience, node, act, value? }.")

    issues: list[ReplyIssue] = []
    for key in js_keys(reply):
        if key not in _REPLY_FIELDS:
            issues.append(ReplyIssue("unknown-field", f"A reply has experience, node, act and value; not {stringify(key)}."))
    if get(reply, "experience") != exp["experience"] or not isinstance(get(reply, "experience"), str):
        issues.append(ReplyIssue("wrong-experience", f'The reply is for {short(get(reply, "experience"))}, not "{exp["experience"]}".'))
    rnode = get(reply, "node")
    node = next((n for n in exp["nodes"] if get(n, "id") == rnode), None) if isinstance(rnode, str) else None
    if node is None:
        issues.append(ReplyIssue("unknown-node", f'"{exp["experience"]}" has no node {short(rnode)}.'))
        return ReplyResult(False, None, issues)
    acts = acts_for(node)
    ract = get(reply, "act")
    if not isinstance(ract, str) or ract not in acts:
        message = f'{node["type"]} "{node["id"]}" takes {" or ".join(acts)}, not {short(ract)}.' if acts else f'{node["type"]} "{node["id"]}" takes no acts.'
        issues.append(ReplyIssue("unknown-act", message))
        return ReplyResult(False, None, issues)
    act = spec_for(node["type"])["acts"][ract]  # type: ignore[index]

    has = get(reply, "value") is not UNDEF
    rule = ("required" if node.get("input") else "none") if node["type"] == "Alternative" else act["value"]
    where = f'{ract} on {node["type"]} "{node["id"]}"'
    if rule == "required" and not has:
        issues.append(ReplyIssue("missing-value", f"{where} must carry a value: {_value_doc(node, act['doc'])}."))
    if rule == "none" and has:
        issues.append(ReplyIssue("unexpected-value", f"{where} carries no value."))
    if has and rule != "none":
        problem = _check_value(node, ract, reply["value"], exp)
        if problem:
            issues.append(ReplyIssue("invalid-value", f"{where}: {problem}."))
    if issues:
        return ReplyResult(False, None, issues)
    return ReplyResult(True, reply, [])


def _text(v: Any, limit: int = 4000) -> bool:
    return isinstance(v, str) and trim(v) != "" and chars(v) <= limit


def _option_ids(n: dict[str, Any] | None) -> list[str]:
    return [o["id"] for o in n["options"]] if n and n.get("type") == "Choice" else []


def _check_value(node: dict[str, Any], act: str, value: Any, experience: dict[str, Any]) -> str | None:
    t = node["type"]
    if t == "Choice":
        ids = _option_ids(node)
        if node.get("multiple") is True:
            if not is_array(value) or len(value) == 0:
                return "a multiple choice takes a non-empty array of option ids"
            if len({key_of(v) for v in value}) != len(value):
                return "each option is picked once"
            unknown = [v for v in value if not (isinstance(v, str) and v in ids)]
            return f'no option {", ".join(short(v) for v in unknown)} (options: {", ".join(ids)})' if unknown else None
        if not isinstance(value, str):
            return "a single choice takes one option id, as a string"
        return None if value in ids else f'no option {short(value)} (options: {", ".join(ids)})'
    if t == "PredictedChoice":
        target = next((n for n in experience["nodes"] if get(n, "id") == node["of"]), None)
        ids = _option_ids(target)
        if not isinstance(value, str) or value not in ids:
            return f'Choice "{node["of"]}" has no option {short(value)}'
        return f'"{value}" is the prediction itself; reply accept instead' if value == node["option"] else None
    if t == "Input":
        return _check_answer(node, value) if act == "submit" else None
    if t == "Form":
        if act != "submit":
            return None
        if not is_object(value):
            return "a form answer is an object from field id to answer"
        fields = node["fields"]
        ids = [f["id"] for f in fields]
        unknown = [k for k in js_keys(value) if k not in ids]
        if unknown:
            return f'no field {", ".join(short(k) for k in unknown)} (fields: {", ".join(ids)})'
        if len(js_keys(value)) == 0:
            return "a form answer gives at least one field" if any(f.get("required") is True for f in fields) else "a form answer gives at least one field; reply skip to answer none"
        missing = [f["id"] for f in fields if f.get("required") is True and value.get(f["id"], UNDEF) is UNDEF]
        if missing:
            many = len(missing) != 1
            return f'required field{"s" if many else ""} {", ".join(chr(34) + m + chr(34) for m in missing)} {"have" if many else "has"} no answer'
        for f in fields:
            if value.get(f["id"], UNDEF) is UNDEF:
                continue
            problem = _check_answer(f, value[f["id"]])
            if problem:
                return f'field "{f["id"]}": {problem}'
        return None
    if t == "Alternative":
        kind = node.get("input")
        if kind == "Price":
            ok = is_object(value) and all(k in ("amount", "currency") for k in value)
            good = ok and is_finite(value.get("amount")) and num(value["amount"]) >= 0 and isinstance(value.get("currency"), str) and _CURRENCY.fullmatch(value["currency"])
            return None if good else "a Price is { amount, currency }: a number of at least 0 and an ISO 4217 code"
        if kind == "Date":
            return None if isinstance(value, str) and parse_date(value) else "a Date is an ISO 8601 date or date-time string"
        return None if _text(value) else f"a {kind} is given in words, as a non-empty string"
    if t == "Preference":
        if not is_scalar(value):
            return "a preference value is a string, a finite number or a boolean"
        if isinstance(value, str) and chars(value) > 4000:
            return "the value is too long"
        options = node.get("options")
        if options is not None and not includes(list(options), value):
            return f'not one of {", ".join(short(o) for o in options)}'
        return None
    if t == "Approval":
        return None if _text(value) else "a rejection's reason is a non-empty string"
    if t == "Correction":
        return None if _text(value) else "a correction is a non-empty string"
    if t == "ExploreMore":
        if not _text(value):
            return "the topic is a non-empty string"
        topics = node.get("topics")
        if topics is not None and not includes(list(topics), value):
            return f'{short(value)} is not one of its topics ({", ".join(short(o) for o in topics)})'
        return None
    return None


def _check_answer(ask: dict[str, Any], value: Any) -> str | None:
    """Why an answer does not fit what an Input (or a Form field, asked the same way) asks for, or None when it does."""
    kind = ask.get("kind")
    if kind in ("number", "money"):
        if not is_finite(value):
            currency = f" in {ask.get('currency')}" if kind == "money" else ""
            return f"a {kind} answer is a finite number{currency}"
        lo, hi = ask.get("min"), ask.get("max")
        if lo is not None and num(value) < num(lo):
            return f"{js_num(value)} is below the minimum {js_num(lo)}"
        if hi is not None and num(value) > num(hi):
            return f"{js_num(value)} is above the maximum {js_num(hi)}"
        return None
    if kind == "date":
        return None if isinstance(value, str) and parse_date(value) else "a date answer is an ISO 8601 date or date-time string"
    if not _text(value):
        return "the answer is a non-empty string"
    s: str = value
    if ask.get("maxLength") is not None and chars(s) > ask["maxLength"]:
        return f"the answer is {chars(s)} characters; the most is {js_num(ask['maxLength'])}"
    if kind == "email" and not _EMAIL.fullmatch(s):
        return f"{short(s)} is not an email address"
    if kind == "phone" and not _PHONE.fullmatch(s):
        return f"{short(s)} is not a phone number"
    if kind == "url" and not url_can_parse(s):
        return f"{short(s)} is not a URL"
    return None


def _value_doc(node: dict[str, Any], doc: str) -> str:
    if node["type"] == "Alternative":
        return "the Price the person gave, as { amount, currency }" if node.get("input") == "Price" else f'the {node.get("input")} the person gave'
    rest = doc[1:]
    if rest.endswith("."):
        rest = rest[:-1]
    return doc[:1].lower() + rest
