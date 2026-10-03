"""feather-sdk: write and check Feather Experience IR (feather.ir/0) from Python. No dependencies.

    from feather_sdk import experience, nodes, validate

    doc = experience("approve", [nodes.Recommendation(id="rec", intent="decide", summary="Ship it")])
    result = validate(doc)
"""

from . import nodes
from ._experience import experience
from ._reply import ReplyIssue, ReplyResult, acts_for, validate_reply
from ._spec import DEFAULT_MAX_LENGTH, IR_VERSION, MAX_ISSUES
from ._validate import Issue, ValidationResult, format_issues, parse_date, validate
from ._version import __version__

__all__ = [
    "DEFAULT_MAX_LENGTH",
    "IR_VERSION",
    "Issue",
    "MAX_ISSUES",
    "ReplyIssue",
    "ReplyResult",
    "ValidationResult",
    "__version__",
    "acts_for",
    "experience",
    "format_issues",
    "nodes",
    "parse_date",
    "validate",
    "validate_reply",
]
