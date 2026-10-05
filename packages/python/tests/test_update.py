import copy
import unittest

from _support import CONFORMANCE, load_json
from feather_sdk import UPDATE_VERSION, apply_update, experience, nodes, ops, update, validate, validate_reply


def trip():
    return experience(
        "plan_trip",
        [
            nodes.Progress(id="work", label="Finding flights", value=0.5),
            nodes.Text(id="intro", text="Hello."),
        ],
    )


def codes(result):
    return [i.code for i in result.issues]


class Versions(unittest.TestCase):
    EXP = {"ir": "feather.ir/0", "experience": "plan_trip", "revision": 1, "nodes": [{"type": "Text", "id": "t", "text": "Hi."}, {"type": "Text", "id": "u", "text": "Yo."}]}

    def change(self, version):
        return {"update": version, "experience": "plan_trip", "revision": 2, "ops": [{"op": "remove", "id": "u"}]}

    def test_update_0_and_1_are_read_as_is(self):
        for version in ("feather.update/0", "feather.update/1"):
            result = apply_update(self.EXP, self.change(version))
            self.assertTrue(result.ok, version)
            self.assertEqual(result.experience["ir"], "feather.ir/0")
            self.assertEqual([n["id"] for n in result.experience["nodes"]], ["t"])

    def test_other_versions_are_refused(self):
        for version in ("feather.update/2", "feather.update/", "FEATHER.UPDATE/1", "feather.ir/1", "", 0, None):
            result = apply_update(self.EXP, self.change(version))
            self.assertFalse(result.ok)
            self.assertEqual([(i.code, i.path) for i in result.issues], [("unsupported-version", "/update")])

    def test_an_ir_1_experience_stays_ir_1(self):
        result = apply_update({**self.EXP, "ir": "feather.ir/1"}, self.change("feather.update/0"))
        self.assertEqual(result.experience["ir"], "feather.ir/1")


class Builders(unittest.TestCase):
    def test_update_and_ops_build_plain_dicts(self):
        change = update(
            "plan_trip",
            1,
            [
                ops.add(nodes.Text(id="t", text="Hi."), after="work"),
                ops.replace(nodes.Text(id="intro", text="New.")),
                ops.patch("work", value=1, label=None),
                ops.patch("work", {"value": 1}),
                ops.remove("intro"),
                ops.resolve("done", "Booked.", artifact={"label": "Receipt"}),
            ],
        )
        self.assertEqual(change["update"], "feather.update/1")
        self.assertEqual(change["ops"][0], {"op": "add", "node": {"type": "Text", "id": "t", "text": "Hi."}, "after": "work"})
        self.assertEqual(change["ops"][2], {"op": "patch", "id": "work", "set": {"value": 1, "label": None}})
        self.assertEqual(change["ops"][3]["set"], {"value": 1})
        self.assertEqual(change["ops"][5], {"op": "resolve", "outcome": "done", "summary": "Booked.", "artifact": {"label": "Receipt"}})
        self.assertNotIn("after", ops.add(nodes.Text(id="t", text="x")))
        self.assertNotIn("artifact", ops.resolve("done", "x"))

    def test_every_builder_has_a_docstring(self):
        for name in ops.__all__:
            self.assertTrue(getattr(ops, name).__doc__, name)
        self.assertTrue(update.__doc__)

    def test_experience_takes_revision_and_resolved(self):
        doc = experience("x", [], revision=3, resolved={"outcome": "done", "summary": "Done."})
        self.assertEqual(doc["revision"], 3)
        self.assertTrue(validate(doc).ok)
        self.assertNotIn("revision", experience("x", [nodes.Text(id="t", text="x")]))
        self.assertNotIn("resolved", experience("x", [nodes.Text(id="t", text="x")]))


class Apply(unittest.TestCase):
    def test_a_streamed_experience(self):
        doc = trip()
        r1 = apply_update(doc, update("plan_trip", 1, [ops.patch("work", value=1)]))
        self.assertTrue(r1.ok, r1.issues)
        self.assertEqual(r1.experience["revision"], 1)
        self.assertEqual(r1.experience["nodes"][0]["value"], 1)
        r2 = apply_update(r1.experience, update("plan_trip", 2, [ops.add(nodes.Recommendation(id="rec", intent="take it", summary="Direct, 9:40"), after="work")]))
        self.assertEqual([n["id"] for n in r2.experience["nodes"]], ["work", "rec", "intro"])
        r3 = apply_update(
            r2.experience,
            update("plan_trip", 3, [ops.resolve("done", "Booked: direct flight, 9:40.", artifact={"label": "Booking", "href": "https://example.com/b/1", "kind": "document"})]),
        )
        self.assertTrue(r3.ok)
        self.assertEqual(r3.experience["resolved"]["outcome"], "done")
        self.assertEqual(r3.experience["resolved"]["artifact"]["kind"], "document")
        self.assertTrue(validate(r3.experience).ok)
        # A resolved experience takes no updates and no replies.
        self.assertEqual(codes(apply_update(r3.experience, update("plan_trip", 4, [ops.remove("rec")]))), ["already-resolved"])
        reply = validate_reply(r3.experience, {"experience": "plan_trip", "node": "rec", "act": "accept"})
        self.assertFalse(reply.ok)
        self.assertEqual(reply.issues[0].code, "resolved")

    def test_it_is_pure(self):
        doc = trip()
        change = update("plan_trip", 1, [ops.patch("work", label="Changed", value=None), ops.add(nodes.Text(id="t", text="x"))])
        before_doc, before_change = copy.deepcopy(doc), copy.deepcopy(change)
        result = apply_update(doc, change)
        self.assertTrue(result.ok)
        self.assertEqual(doc, before_doc)
        self.assertEqual(change, before_change)
        # The result shares nothing with its inputs.
        result.experience["nodes"][2]["text"] = "mutated"
        result.experience["nodes"][0]["label"] = "mutated"
        self.assertEqual(change, before_change)
        self.assertEqual(doc, before_doc)

    def test_a_patch_to_none_removes_the_field(self):
        doc = experience("x", [nodes.Recommendation(id="rec", intent="i", summary="s", confidence=0.5)])
        result = apply_update(doc, update("x", 1, [ops.patch("rec", confidence=None)]))
        self.assertNotIn("confidence", result.experience["nodes"][0])

    def test_all_or_nothing(self):
        doc = trip()
        result = apply_update(doc, update("plan_trip", 1, [ops.patch("work", value=1), ops.remove("ghost")]))
        self.assertFalse(result.ok)
        self.assertIsNone(result.experience)
        self.assertEqual([(i.code, i.path) for i in result.issues], [("unknown-node", "/ops/1/id")])
        self.assertEqual(doc, trip())

    def test_the_stale_revision(self):
        result = apply_update(trip(), update("plan_trip", 3, [ops.remove("intro")]))
        self.assertFalse(result.ok)
        self.assertTrue(result.stale)
        self.assertEqual([(i.code, i.path) for i in result.issues], [("stale-revision", "/revision")])
        self.assertIn("revision 0", result.issues[0].message)
        self.assertFalse(apply_update(trip(), update("plan_trip", 1, [ops.remove("intro")])).stale)

    def test_an_invalid_result_is_reported_under_result(self):
        result = apply_update(trip(), update("plan_trip", 1, [ops.add(nodes.Text(id="t", text=""))]))
        self.assertEqual([(i.code, i.path) for i in result.issues], [("empty-text", "/result/nodes/2/text")])
        self.assertTrue(result.issues[0].message.startswith("After the update, "))

    def test_removing_everything_leaves_an_empty_experience_unless_resolved(self):
        everything = [ops.remove("work"), ops.remove("intro")]
        self.assertEqual([i.code for i in apply_update(trip(), update("plan_trip", 1, everything)).issues], ["empty-experience"])
        done = apply_update(trip(), update("plan_trip", 1, [*everything, ops.resolve("cancelled", "Never mind.")]))
        self.assertTrue(done.ok)
        self.assertEqual(done.experience["nodes"], [])

    def test_resolve_is_the_last_op(self):
        result = apply_update(trip(), update("plan_trip", 1, [ops.resolve("done", "x"), ops.remove("intro")]))
        self.assertEqual([(i.code, i.path) for i in result.issues], [("after-resolve", "/ops/1")])

    def test_the_issue_limit(self):
        result = apply_update(trip(), update("plan_trip", 1, [ops.remove("ghost")] * 120))
        self.assertEqual(len(result.issues), 101)
        self.assertEqual(result.issues[-1].code, "too-many-issues")

    def test_it_never_raises(self):
        for bad in (None, 5, "x", [], {"update": object()}, {"update": UPDATE_VERSION, "experience": "plan_trip", "revision": 1, "ops": [{"op": "remove", "id": {1, 2}}]}):
            result = apply_update(trip(), bad)
            self.assertFalse(result.ok)
        self.assertFalse(apply_update(None, {}).ok)

    def test_the_conformance_fixtures(self):
        for path in sorted((CONFORMANCE / "update/invalid").glob("*.json")):
            with self.subTest(path.stem):
                fixture = load_json(path)
                result = apply_update(fixture["experience"], fixture["update"])
                self.assertFalse(result.ok)
                self.assertEqual([(i.code, i.path) for i in result.issues], [(e["code"], e["path"]) for e in fixture["expect"]])
        for path in sorted((CONFORMANCE / "update/valid").glob("*.json")):
            with self.subTest(path.stem):
                fixture = load_json(path)
                current = fixture["experience"]
                for step in fixture["updates"]:
                    result = apply_update(current, step)
                    self.assertTrue(result.ok, result.issues)
                    current = result.experience
                self.assertEqual(current["revision"], len(fixture["updates"]))


class Resolution(unittest.TestCase):
    def check(self, resolved, nodes_=None):
        return validate(experience("x", [] if nodes_ is None else nodes_, resolved=resolved))

    def test_a_resolved_experience_may_have_no_nodes(self):
        self.assertTrue(self.check({"outcome": "done", "summary": "Done."}).ok)
        self.assertEqual([i.code for i in validate(experience("x", [])).issues], ["empty-experience"])

    def test_each_branch_of_the_check(self):
        done = {"outcome": "done", "summary": "Done."}
        expected = [
            ({"summary": "x"}, [("missing-field", "/resolved/outcome")]),
            ({"outcome": "finished", "summary": "x"}, [("invalid-value", "/resolved/outcome")]),
            ({"outcome": "done"}, [("missing-field", "/resolved/summary")]),
            ({"outcome": "done", "summary": 5}, [("wrong-type", "/resolved/summary")]),
            ({"outcome": "done", "summary": "  "}, [("empty-text", "/resolved/summary")]),
            ({"outcome": "done", "summary": "a\nb"}, [("too-long", "/resolved/summary")]),
            ({"outcome": "done", "summary": "x" * 121}, [("too-long", "/resolved/summary")]),
            ({**done, "color": "red"}, [("presentational-field", "/resolved/color")]),
            ({**done, "artifact": {"href": "https://example.com"}}, [("missing-field", "/resolved/artifact/label")]),
            ({**done, "artifact": {"label": "x", "kind": "archive"}}, [("invalid-value", "/resolved/artifact/kind")]),
            ({**done, "artifact": {"label": "x", "href": ""}}, [("empty-text", "/resolved/artifact/href")]),
        ]
        for resolved, issues in expected:
            with self.subTest(resolved):
                self.assertEqual([(i.code, i.path) for i in self.check(resolved).issues], issues)
        self.assertEqual([i.code for i in self.check("done").issues], ["wrong-type"])

    def test_the_summary_counts_code_points(self):
        self.assertTrue(self.check({"outcome": "done", "summary": "😀" * 120}).ok)
        self.assertFalse(self.check({"outcome": "done", "summary": "😀" * 121}).ok)

    def test_revision(self):
        for revision, ok in ((0, True), (7, True), (-1, False), (1.5, False), ("1", False), (True, False)):
            with self.subTest(revision):
                doc = experience("x", [nodes.Text(id="t", text="x")], revision=revision)
                self.assertEqual(validate(doc).ok, ok)

    def test_a_resolved_experience_takes_no_replies(self):
        doc = experience("x", [nodes.Action(id="go", intent="go")], resolved={"outcome": "failed", "summary": "Sold out."})
        reply = validate_reply(doc, {"experience": "x", "node": "go", "act": "activate"})
        self.assertEqual([i.code for i in reply.issues], ["resolved"])
        self.assertIn("is resolved (failed)", reply.issues[0].message)


if __name__ == "__main__":
    unittest.main()
