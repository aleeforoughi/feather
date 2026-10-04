import unittest

from _support import fixtures
from feather_sdk import IR_VERSION, experience, format_issues, nodes, validate, validate_reply
from feather_sdk._spec import NODES


def ad_campaign():
    return experience(
        "approve_campaign",
        [
            nodes.Recommendation(
                id="rec",
                intent="launch the recommended test",
                importance="high",
                reversible=False,
                summary="Recommended test: 7 days, purchase objective",
                expandable={"why": "Enough to test three creative directions without overspending."},
            ),
            nodes.Price(id="cap", amount=1050, currency="AED", label="Maximum spend"),
            nodes.IrreversibleAction(
                id="go",
                intent="confirm spend",
                importance="critical",
                reversible=False,
                consequence={"spend": {"amount": 1050, "currency": "AED"}},
            ),
            nodes.Alternative(id="less", intent="spend less"),
            nodes.Alternative(id="own", intent="set my own budget", input="Price"),
        ],
    )


class Builders(unittest.TestCase):
    def test_the_ad_campaign_builds_and_validates(self):
        doc = ad_campaign()
        result = validate(doc)
        self.assertTrue(result.ok, format_issues(result.issues))
        self.assertEqual(doc["ir"], IR_VERSION)

    def test_it_equals_the_fixture(self):
        fixture = dict(fixtures("valid"))["ad-campaign-launch"]["ir"]
        self.assertEqual(ad_campaign(), fixture)

    def test_none_is_dropped_and_type_is_set(self):
        node = nodes.Text(id="t", text="hello")
        self.assertEqual(node, {"type": "Text", "id": "t", "text": "hello"})
        nested = nodes.Approval(id="a", intent="approve", request="May I?", consequence={"send": {"to": "all", "channel": None}})
        self.assertEqual(nested["consequence"], {"send": {"to": "all"}})

    def test_locale_is_optional(self):
        self.assertNotIn("locale", experience("x", []))
        self.assertEqual(experience("x", [], locale="ar-AE")["locale"], "ar-AE")

    def test_reserved_word_fields_get_a_trailing_underscore(self):
        node = nodes.Alternative(id="alt", intent="other", for_="rec")
        self.assertEqual(node["for"], "rec")

    def test_required_arguments_are_required(self):
        with self.assertRaises(TypeError):
            nodes.Text(id="t")  # type: ignore[call-arg]
        with self.assertRaises(TypeError):
            nodes.Action(id="a")  # type: ignore[call-arg]
        with self.assertRaises(TypeError):
            nodes.Text("t", "hello")  # type: ignore[misc]

    def test_every_node_type_has_a_builder(self):
        self.assertEqual(set(nodes.__all__), {n["type"] for n in NODES})
        for name in nodes.__all__:
            self.assertEqual(getattr(nodes, name).__name__, name)
            self.assertTrue(getattr(nodes, name).__doc__)

    def test_builders_do_not_validate(self):
        self.assertFalse(validate(experience("x", [nodes.Text(id="t", text="")])).ok)

    def test_builders_reproduce_every_valid_fixture(self):
        # Rebuild each node through its builder from its own fields: the builders cover every field of every type.
        for name, fixture in fixtures("valid"):
            with self.subTest(name):
                rebuilt = []
                for node in fixture["ir"]["nodes"]:
                    kwargs = {("for_" if k == "for" else k): v for k, v in node.items() if k != "type"}
                    rebuilt.append(getattr(nodes, node["type"])(**kwargs))
                doc = experience(fixture["ir"]["experience"], rebuilt, locale=fixture["ir"].get("locale"))
                self.assertEqual(doc, fixture["ir"])
                self.assertTrue(validate(doc).ok)

    def test_a_reply_to_a_built_experience(self):
        doc = ad_campaign()
        reply = {"experience": "approve_campaign", "node": "own", "act": "choose", "value": {"amount": 500, "currency": "AED"}}
        self.assertTrue(validate_reply(doc, reply).ok)
        bad = validate_reply(doc, {**reply, "value": "lots"})
        self.assertFalse(bad.ok)
        self.assertEqual(bad.issues[0].code, "invalid-value")



class FormBuilder(unittest.TestCase):
    def form(self, *fields):
        return experience("details", [nodes.Form(id="details", intent="give the details", primary=True, fields=list(fields))])

    def test_a_form_builds_and_validates(self):
        doc = self.form(
            nodes.Form(id="x", intent="i", fields=[{"id": "a", "prompt": "A", "kind": "text"}])["fields"][0],
            {"id": "fee", "prompt": "Fee", "kind": "money", "currency": "AED", "required": True},
        )
        self.assertEqual(doc["nodes"][0]["type"], "Form")
        self.assertTrue(validate(doc).ok, format_issues(validate(doc).issues))

    def test_form_field_rules(self):
        dup = self.form({"id": "a", "prompt": "A", "kind": "text"}, {"id": "a", "prompt": "B", "kind": "number", "min": 5, "max": 1})
        codes = [i.code for i in validate(dup).issues]
        self.assertEqual(codes, ["duplicate-field", "out-of-range"])
        money = self.form({"id": "m", "prompt": "M", "kind": "money"})
        self.assertEqual([i.code for i in validate(money).issues], ["missing-field"])

    def test_form_replies(self):
        optional = self.form({"id": "a", "prompt": "A", "kind": "text"}, {"id": "n", "prompt": "N", "kind": "number", "min": 1})
        reply = {"experience": "details", "node": "details", "act": "submit", "value": {"a": "hello"}}
        self.assertTrue(validate_reply(optional, reply).ok)
        self.assertFalse(validate_reply(optional, {**reply, "value": {"n": 0}}).ok)
        self.assertFalse(validate_reply(optional, {**reply, "value": {"zzz": 1}}).ok)
        self.assertFalse(validate_reply(optional, {**reply, "value": ["a"]}).ok)
        self.assertTrue(validate_reply(optional, {"experience": "details", "node": "details", "act": "skip"}).ok)

        required = self.form({"id": "a", "prompt": "A", "kind": "text", "required": True}, {"id": "n", "prompt": "N", "kind": "number"})
        skip = validate_reply(required, {"experience": "details", "node": "details", "act": "skip"})
        self.assertFalse(skip.ok)
        self.assertEqual(skip.issues[0].code, "unknown-act")
        missing = validate_reply(required, {**reply, "value": {"n": 2}})
        self.assertIn('required field "a" has no answer', missing.issues[0].message)
        self.assertTrue(validate_reply(required, {**reply, "value": {"a": "x", "n": 2}}).ok)


if __name__ == "__main__":
    unittest.main()
