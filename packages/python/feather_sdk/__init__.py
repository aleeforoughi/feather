"""feather-sdk: call Feather from Python. Build and check Experience IR (feather.ir/1), check replies, change an open
experience with updates (feather.update/1, apply_update()), and serve the browser bundle that renders experiences
(static_dir()). No dependencies.

    from feather_sdk import experience, nodes, validate

    doc = experience("approve", [nodes.Recommendation(id="rec", intent="decide", summary="Ship it")])
    result = validate(doc)
"""

from . import nodes, ops
from ._experience import experience, update
from ._reply import ReplyIssue, ReplyResult, acts_for, validate_reply
from ._static import static_dir
from ._spec import DEFAULT_MAX_LENGTH, IR_VERSION, MAX_ISSUES, UPDATE_VERSION
from ._update import UpdateIssue, UpdateResult, apply_update
from ._validate import Issue, ValidationResult, format_issues, parse_date, validate
from ._version import __version__

__all__ = [
    "DEFAULT_MAX_LENGTH",
    "IR_VERSION",
    "Issue",
    "MAX_ISSUES",
    "ReplyIssue",
    "ReplyResult",
    "UPDATE_VERSION",
    "UpdateIssue",
    "UpdateResult",
    "ValidationResult",
    "__version__",
    "acts_for",
    "apply_update",
    "experience",
    "format_issues",
    "nodes",
    "ops",
    "parse_date",
    "static_dir",
    "update",
    "validate",
    "validate_reply",
]
