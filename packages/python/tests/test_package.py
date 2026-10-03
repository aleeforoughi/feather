import ast
import json
import sys
import tomllib
import unittest
from pathlib import Path

from _support import PACKAGE, load_json
import feather_sdk
from feather_sdk import Issue, format_issues, validate, validate_reply
from feather_sdk._spec import ISSUE_CODES, MAX_ISSUES, REPLY_ISSUE_CODES

ROOT = PACKAGE.parents[1]


class Version(unittest.TestCase):
    def test_it_matches_the_feather_version(self):
        feather = load_json(ROOT / "package.json")["version"]
        self.assertEqual(feather_sdk.__version__, feather)
        self.assertEqual(load_json(ROOT / "packages/intent/package.json")["version"], feather)

    def test_pyproject_reads_the_version_from_the_package(self):
        project = tomllib.loads((PACKAGE / "pyproject.toml").read_text("utf-8"))
        self.assertIn("version", project["project"]["dynamic"])
        self.assertEqual(project["tool"]["setuptools"]["dynamic"]["version"], {"attr": "feather_sdk._version.__version__"})

    def test_ir_version(self):
        self.assertEqual(feather_sdk.IR_VERSION, "feather.ir/0")


class NoDependencies(unittest.TestCase):
    def test_pyproject_declares_none(self):
        project = tomllib.loads((PACKAGE / "pyproject.toml").read_text("utf-8"))
        self.assertEqual(project["project"].get("dependencies"), [])
        self.assertNotIn("optional-dependencies", project["project"])
        self.assertGreaterEqual(tuple(map(int, project["project"]["requires-python"].strip(">=").split("."))), (3, 11))

    def test_the_package_imports_only_the_standard_library(self):
        for path in (PACKAGE / "feather_sdk").glob("*.py"):
            for node in ast.walk(ast.parse(path.read_text("utf-8"))):
                modules = []
                if isinstance(node, ast.Import):
                    modules = [a.name for a in node.names]
                elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                    modules = [node.module]
                for module in modules:
                    self.assertIn(module.split(".")[0], sys.stdlib_module_names, f"{path.name} imports {module}")

    def test_it_is_typed(self):
        self.assertTrue((PACKAGE / "feather_sdk/py.typed").exists())


class Reading(unittest.TestCase):
    DOC = {"ir": "feather.ir/0", "experience": "e", "nodes": [{"type": "Text", "id": "t", "text": "hi"}]}

    def test_a_json_string_is_read(self):
        result = validate(json.dumps(self.DOC))
        self.assertTrue(result.ok)
        self.assertEqual(result.experience, self.DOC)
        self.assertTrue(validate(json.dumps(self.DOC).encode()).ok)

    def test_unparseable_text_is_unreadable(self):
        for text in ["", "{", "not json", '{"a": NaN}', '{"a": Infinity}']:
            with self.subTest(text):
                result = validate(text)
                self.assertFalse(result.ok)
                self.assertEqual([i.code for i in result.issues], ["unreadable"])
                self.assertEqual(result.issues[0].path, "")

    def test_text_that_is_json_but_not_an_object(self):
        self.assertEqual([i.code for i in validate("[1]").issues], ["not-an-object"])
        self.assertEqual([i.code for i in validate('"x"').issues], ["not-an-object"])

    def test_it_never_raises(self):
        loop: dict = {}
        loop["me"] = loop
        weird = [None, 1, 2.5, True, object(), {1: 2}, {"ir": object()}, {"ir": "feather.ir/0", "experience": "e", "nodes": [object()]}, {"ir": "feather.ir/0", "experience": "e", "nodes": [{"type": "Text", "id": "t", "text": {1, 2}}]}, loop, {"ir": "feather.ir/0", "experience": "e", "nodes": [loop]}, b"\xff", float("nan")]
        for value in weird:
            with self.subTest(repr(value)[:40]):
                result = validate(value)
                self.assertFalse(result.ok)
                self.assertTrue(all(isinstance(i, Issue) for i in result.issues))
                validate_reply(value, {"experience": "e", "node": "t", "act": "x"})
                validate_reply(self.DOC, value)

    def test_tuples_are_arrays(self):
        doc = {"ir": "feather.ir/0", "experience": "e", "nodes": ({"type": "Text", "id": "t", "text": "hi"},)}
        self.assertTrue(validate(doc).ok)

    def test_issues_are_frozen(self):
        issue = validate({}).issues[0]
        with self.assertRaises(Exception):
            issue.code = "x"  # type: ignore[misc]

    def test_the_issue_limit(self):
        doc = {"ir": "feather.ir/0", "experience": "e", "nodes": [{"type": "Text", "id": "t", "text": ""}] * 150}
        issues = validate(doc).issues
        self.assertEqual(len(issues), MAX_ISSUES + 1)
        self.assertEqual(issues[-1].code, "too-many-issues")
        self.assertEqual(MAX_ISSUES, 100)

    def test_codes_are_the_typescript_codes(self):
        self.assertIn("unreadable", ISSUE_CODES)
        self.assertIn("too-many-issues", ISSUE_CODES)
        self.assertIn("invalid-experience", REPLY_ISSUE_CODES)

    def test_issue_dataclass_fields(self):
        issue = validate({"ir": "feather.ir/0", "experience": "e", "nodes": [{"type": "Text", "id": "t", "text": ""}]}).issues[0]
        self.assertEqual((issue.code, issue.path, issue.node), ("empty-text", "/nodes/0/text", "t"))
        self.assertIsNone(validate(5).issues[0].node)


class Formatting(unittest.TestCase):
    def test_format_issues(self):
        issues = validate({"ir": "feather.ir/0", "experience": "e", "nodes": []}).issues
        self.assertEqual(
            format_issues(issues),
            "- /nodes: An experience with no nodes renders nothing; send at least one node, or no experience. [empty-experience]",
        )
        self.assertEqual(format_issues(validate(5).issues), '- (document): An experience is a JSON object with "ir", "experience" and "nodes"; got a number. [not-an-object]')
        self.assertEqual(format_issues([]), "")


if __name__ == "__main__":
    unittest.main()
