import unittest

from _support import fixtures
from feather_sdk import format_issues, validate


class ValidFixtures(unittest.TestCase):
    def test_there_are_fixtures(self):
        self.assertGreaterEqual(len(fixtures("valid")), 40)

    def test_every_valid_fixture_is_ok(self):
        for name, fixture in fixtures("valid"):
            with self.subTest(name):
                result = validate(fixture["ir"])
                self.assertTrue(result.ok, format_issues(result.issues))
                self.assertIs(result.experience, fixture["ir"])
                self.assertEqual(result.issues, [])


class InvalidFixtures(unittest.TestCase):
    def test_every_invalid_fixture_gives_exactly_its_expected_issues_in_order(self):
        cases = fixtures("invalid")
        self.assertGreaterEqual(len(cases), 20)
        for name, fixture in cases:
            with self.subTest(name):
                result = validate(fixture["ir"])
                self.assertFalse(result.ok)
                self.assertIsNone(result.experience)
                self.assertEqual([(i.code, i.path) for i in result.issues], [(e["code"], e["path"]) for e in fixture["expect"]])


if __name__ == "__main__":
    unittest.main()
