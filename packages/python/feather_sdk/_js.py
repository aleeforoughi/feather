"""JavaScript semantics the validator must reproduce to give the same words as the TypeScript one.

Messages quote values with JSON.stringify, print numbers the way JavaScript does, count text in UTF-16 units where
JavaScript does, and iterate object keys in JavaScript's order. These helpers keep that out of the validator itself.
"""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Any


class _Undefined:
    """JavaScript's `undefined`: a key that is not there. A JSON null is Python's None."""

    _instance: _Undefined | None = None

    def __new__(cls) -> _Undefined:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __repr__(self) -> str:
        return "UNDEF"

    def __bool__(self) -> bool:
        return False


UNDEF: Any = _Undefined()

# What JavaScript calls whitespace (String.prototype.trim, the \s class).
WS = "\t\n\v\f\r                  　﻿"
WS_CLASS = r"\t\n\v\f\r    -     　﻿"


def trim(s: str) -> str:
    return s.strip(WS)


def is_object(v: Any) -> bool:
    return isinstance(v, dict)


def is_array(v: Any) -> bool:
    return isinstance(v, (list, tuple))


def is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def num(v: Any) -> float:
    """A number as a JavaScript double: an int too large for one becomes Infinity, as JSON.parse would give."""
    try:
        return float(v)
    except OverflowError:
        return float("inf") if v > 0 else float("-inf")


def is_finite(v: Any) -> bool:
    if not is_number(v):
        return False
    f = num(v)
    return f == f and f not in (float("inf"), float("-inf"))


def is_integer(v: Any) -> bool:
    return is_finite(v) and num(v).is_integer()


def is_scalar(v: Any) -> bool:
    return isinstance(v, str) or isinstance(v, bool) or is_finite(v)


def js_num(v: Any) -> str:
    """Number.prototype.toString."""
    f = num(v)
    if f != f:
        return "NaN"
    if f == float("inf"):
        return "Infinity"
    if f == float("-inf"):
        return "-Infinity"
    if f == 0:
        return "0"
    sign = "-" if f < 0 else ""
    _, digit_tuple, exp = Decimal(repr(abs(f))).as_tuple()
    digits = "".join(map(str, digit_tuple)).rstrip("0") or "0"
    # Decimal(repr) may carry trailing zeros (as in 1e+22 -> "1E+22"); the point sits after len(all digits) + exp.
    n = len(digit_tuple) + int(exp)
    k = len(digits)
    if k <= n <= 21:
        return sign + digits + "0" * (n - k)
    if 0 < n <= 21:
        return sign + digits[:n] + "." + digits[n:]
    if -6 < n <= 0:
        return sign + "0." + "0" * (-n) + digits
    e = n - 1
    es = ("+" if e >= 0 else "-") + str(abs(e))
    if k == 1:
        return f"{sign}{digits}e{es}"
    return f"{sign}{digits[0]}.{digits[1:]}e{es}"


def js_keys(d: dict[Any, Any]) -> list[str]:
    """Object.keys order: integer-like keys ascending first, then the rest as inserted."""
    ints: list[tuple[int, str]] = []
    rest: list[str] = []
    for k in d:
        if not isinstance(k, str):
            raise TypeError(f"object keys must be strings, got {type(k).__name__}")
        if re.fullmatch(r"0|[1-9][0-9]*", k) and int(k) < 4294967295:
            ints.append((int(k), k))
        else:
            rest.append(k)
    return [k for _, k in sorted(ints)] + rest


def get(o: dict[str, Any], key: str) -> Any:
    return o.get(key, UNDEF)


def u16(s: str) -> bytes:
    return s.encode("utf-16-le", "surrogatepass")


def u16len(s: str) -> int:
    return len(u16(s)) // 2


def u16slice(s: str, start: int, end: int) -> str:
    return u16(s)[2 * start : 2 * end].decode("utf-16-le", "surrogatepass")


def chars(s: str) -> int:
    """Length in Unicode code points, not UTF-16 units."""
    return len(s)


_ESCAPES = {'"': '\\"', "\\": "\\\\", "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r", "\t": "\\t"}


def _json_string(s: str) -> str:
    out = ['"']
    for ch in s:
        o = ord(ch)
        if ch in _ESCAPES:
            out.append(_ESCAPES[ch])
        elif o < 0x20 or 0xD800 <= o <= 0xDFFF:
            out.append(f"\\u{o:04x}")
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def stringify(v: Any) -> str | None:
    """JSON.stringify: None for undefined, "null" for non-finite numbers, compact, keys in JavaScript order."""
    if v is UNDEF:
        return None
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, str):
        return _json_string(v)
    if is_number(v):
        return js_num(v) if is_finite(v) else "null"
    if is_array(v):
        return "[" + ",".join(stringify(x) or "null" for x in v) + "]"
    if isinstance(v, dict):
        parts = []
        for k in js_keys(v):
            s = stringify(v[k])
            if s is not None:
                parts.append(f"{_json_string(k)}:{s}")
        return "{" + ",".join(parts) + "}"
    raise TypeError(f"{type(v).__name__} is not JSON data")


def to_string(v: Any) -> str:
    """String(v) for the values JSON.stringify returns nothing for."""
    if v is UNDEF:
        return "undefined"
    return str(v)


def describe(v: Any) -> str:
    if is_array(v):
        return "an array"
    if v is None:
        return "null"
    if isinstance(v, dict):
        return "an object"
    if is_number(v):
        return js_num(v) if not is_finite(v) else "a number"
    if isinstance(v, bool):
        return "a boolean"
    if isinstance(v, str):
        return "a string"
    if v is UNDEF:
        return "a undefined"
    raise TypeError(f"{type(v).__name__} is not JSON data")


def _truncate(s: str, limit: int) -> str:
    return u16slice(s, 0, limit - 3) + "…" if u16len(s) > limit else s


def quote(v: Any) -> str:
    try:
        s = stringify(v)
        if s is None:
            s = to_string(v)
    except Exception:
        s = describe(v)
    return _truncate(s, 80)


def short(v: Any) -> str:
    s = stringify(v)
    if s is None:
        s = to_string(v)
    return _truncate(s, 60)


def key_of(v: Any) -> Any:
    """A hashable stand-in that is equal exactly when JavaScript's SameValueZero says two values are."""
    if isinstance(v, bool):
        return ("b", v)
    if is_number(v):
        f = num(v)
        return ("n", "NaN" if f != f else f)
    if isinstance(v, str):
        return ("s", v)
    if v is None:
        return ("null",)
    return ("o", id(v))


def same(a: Any, b: Any) -> bool:
    return key_of(a) == key_of(b)


def includes(items: list[Any], v: Any) -> bool:
    k = key_of(v)
    return any(key_of(i) == k for i in items)


# ── URL.canParse(s), with no base ───────────────────────────────────────────────────────────────────────────────

_SPECIAL = {"http", "https", "ws", "wss", "ftp", "file"}
_FORBIDDEN_HOST = set("\x00\t\n\r #/:<>?@[\\]^|")


def _ipv4_number(part: str) -> int | None:
    if part == "":
        return None
    base = 10
    if len(part) >= 2 and part[:2].lower() == "0x":
        part, base = part[2:], 16
    elif len(part) >= 2 and part[0] == "0":
        part, base = part[1:], 8
    if part == "":
        return 0
    try:
        if base == 10 and not re.fullmatch(r"[0-9]+", part):
            return None
        if base == 16 and not re.fullmatch(r"[0-9a-fA-F]+", part):
            return None
        if base == 8 and not re.fullmatch(r"[0-7]+", part):
            return None
        return int(part, base)
    except ValueError:
        return None


def _special_host_ok(host: str) -> bool:
    if host == "":
        return False
    if host.startswith("["):
        return host.endswith("]") and re.fullmatch(r"\[[0-9a-fA-F:.]+\]", host) is not None and ":" in host
    # percent-decode, then forbid domain code points.
    try:
        from urllib.parse import unquote

        decoded = unquote(host, errors="strict")
    except UnicodeDecodeError:
        return False
    if decoded == "":
        return False
    for ch in decoded:
        if ch in _FORBIDDEN_HOST or ch == "%" or ord(ch) <= 0x1F or ord(ch) == 0x7F:
            return False
    parts = decoded.split(".")
    if parts and parts[-1] == "":
        parts = parts[:-1]
    if parts:
        last = parts[-1]
        if re.fullmatch(r"[0-9]+", last) or re.fullmatch(r"0[xX][0-9a-fA-F]*", last):
            # An IPv4 address: at most four numbers, each in range, the last filling what is left.
            if len(parts) > 4:
                return False
            nums = [_ipv4_number(p) for p in parts]
            if any(n is None for n in nums):
                return False
            ints = [n for n in nums if n is not None]
            if any(n > 255 for n in ints[:-1]) or ints[-1] >= 256 ** (5 - len(ints)):
                return False
    return True


def url_can_parse(s: str) -> bool:
    """An approximation of the WHATWG URL parser's yes or no, for strings with no base URL."""
    s = s.strip("".join(chr(c) for c in range(0x21)))
    s = re.sub(r"[\t\n\r]", "", s)
    m = re.match(r"([A-Za-z][A-Za-z0-9+.\-]*):", s)
    if not m:
        return False
    scheme = m.group(1).lower()
    rest = s[m.end() :]
    special = scheme in _SPECIAL
    if scheme == "file":
        return True
    if special:
        rest = rest.lstrip("/\\")
    elif not rest.startswith("//"):
        return True
    else:
        rest = rest[2:]
    end = len(rest)
    for i, ch in enumerate(rest):
        if ch in "/?#" or (special and ch == "\\"):
            end = i
            break
    authority = rest[:end]
    if "@" in authority:
        creds, _, authority = authority.rpartition("@")
        if authority == "":
            return False
    if authority.startswith("["):
        close = authority.find("]")
        if close < 0:
            return False
        host, tail = authority[: close + 1], authority[close + 1 :]
        if tail and not tail.startswith(":"):
            return False
        port = tail[1:] if tail else ""
    else:
        host, colon, port = authority.partition(":")
        if not colon:
            port = ""
    if port != "" and (not re.fullmatch(r"[0-9]+", port) or int(port) > 65535):
        return False
    if special:
        return _special_host_ok(host)
    if host.startswith("["):
        return re.fullmatch(r"\[[0-9a-fA-F:.]+\]", host) is not None
    return not any(ch in _FORBIDDEN_HOST for ch in host)
