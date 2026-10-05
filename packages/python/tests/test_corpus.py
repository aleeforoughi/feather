"""The parity corpus: what the TypeScript validate() and validateReply() answer, which Python must answer word for word."""

import copy
import unittest

from _support import CONFORMANCE, issue_dict, load_json
from feather_sdk import apply_update, validate, validate_reply
from feather_sdk._js import url_can_parse
from feather_sdk._spec import UPDATE_ISSUE_CODES


class IrCorpus(unittest.TestCase):
    def test_every_case_matches_typescript(self):
        corpus = load_json(CONFORMANCE / "parity/ir.json")
        self.assertGreaterEqual(len(corpus), 300)
        failures = []
        for case in corpus:
            document = case["ir"]
            # A document that is a JSON string is read as JSON text; hand it over as the text of that string.
            if isinstance(document, str):
                import json

                document = json.dumps(document)
            result = validate(document)
            got = [] if result.ok else [issue_dict(i) for i in result.issues]
            if got != case["issues"]:
                failures.append(case["name"])
        self.assertEqual(failures[:10], [], f"{len(failures)} of {len(corpus)} cases differ")

    def test_the_corpus_has_valid_and_invalid_cases(self):
        corpus = load_json(CONFORMANCE / "parity/ir.json")
        self.assertTrue(any(not c["issues"] for c in corpus))
        self.assertGreater(len({i["code"] for c in corpus for i in c["issues"]}), 35)


class ReplyCorpus(unittest.TestCase):
    def test_every_case_matches_typescript(self):
        corpus = load_json(CONFORMANCE / "parity/reply.json")
        self.assertGreaterEqual(len(corpus["cases"]), 300)
        failures = []
        for case in corpus["cases"]:
            result = validate_reply(corpus["experiences"][case["experience"]], case["reply"])
            got = [] if result.ok else [{"code": i.code, "message": i.message} for i in result.issues]
            if got != case["issues"]:
                failures.append(case["name"])
        self.assertEqual(failures[:10], [], f"{len(failures)} of {len(corpus['cases'])} cases differ")

    def test_ok_results_carry_the_reply(self):
        corpus = load_json(CONFORMANCE / "parity/reply.json")
        for case in corpus["cases"]:
            if not case["issues"]:
                result = validate_reply(corpus["experiences"][case["experience"]], case["reply"])
                self.assertTrue(result.ok)
                self.assertEqual(result.reply, case["reply"])
                return
        self.fail("no ok case")


class UpdateCorpus(unittest.TestCase):
    def test_every_case_matches_typescript(self):
        corpus = load_json(CONFORMANCE / "parity/update.json")
        self.assertGreaterEqual(len(corpus["cases"]), 250)
        failures = []
        for case in corpus["cases"]:
            experience = copy.deepcopy(corpus["experiences"][case["experience"]])
            update = copy.deepcopy(case["update"])
            result = apply_update(experience, update)
            if result.ok != case["ok"]:
                failures.append(case["name"])
            elif result.ok:
                if result.experience != case["result"] or list(result.experience) != list(case["result"]):
                    failures.append(case["name"])
            elif [{"code": i.code, "path": i.path, "message": i.message} for i in result.issues] != case["issues"]:
                failures.append(case["name"])
            # Pure: neither input changed, and the result shares nothing with them.
            if experience != corpus["experiences"][case["experience"]] or update != case["update"]:
                failures.append(f"{case['name']} (changed its input)")
        self.assertEqual(failures[:10], [], f"{len(failures)} of {len(corpus['cases'])} cases differ")

    def test_the_corpus_has_ok_and_refused_cases(self):
        corpus = load_json(CONFORMANCE / "parity/update.json")
        self.assertTrue(any(c["ok"] for c in corpus["cases"]))
        codes = {i["code"] for c in corpus["cases"] for i in c.get("issues", [])}
        for code in UPDATE_ISSUE_CODES:
            self.assertIn(code, codes)


class UrlCorpus(unittest.TestCase):
    def test_url_parsing_matches_typescript(self):
        corpus = load_json(CONFORMANCE / "parity/url.json")
        self.assertEqual([s for s, expected in corpus if url_can_parse(s) != expected], [])


if __name__ == "__main__":
    unittest.main()
