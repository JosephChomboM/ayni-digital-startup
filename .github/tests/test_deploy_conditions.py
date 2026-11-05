"""Regression cases for the actual deployment expressions (no third-party deps).

This evaluates only the expression subset used by these gates. actionlint checks
GitHub syntax; this test does not claim to reproduce the Actions scheduler.
"""
import re
import os
import subprocess
import textwrap
import unittest
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[1] / "workflows" / "ci-cd.yml"
SOURCE = WORKFLOW.read_text()


def block(job):
    return re.search(rf"^  {job}:\n(.*?)(?=^  [\w-]+:|\Z)", SOURCE, re.M | re.S)[1]


def condition(job):
    return re.search(r"if: (?:>-\n\s*)?\$\{\{(.*?)\}\}", block(job), re.S)[1]


def allows(job, results, event="push", ref="refs/heads/main", cancelled=False,
           ancestor_skipped=True):
    expression = condition(job)
    # Without a status function GitHub applies implicit success(); this is the
    # regression from an intentionally skipped transitive prerequisite.
    if not re.search(r"\b(?:cancelled|always|success|failure)\(\)", expression):
        if ancestor_skipped:
            return False
    values = {"github.event_name": event, "github.ref": ref}
    values.update({f"needs.{key}.result": value for key, value in results.items()})
    terms = []
    for term in expression.split("&&"):
        term = term.strip()
        if term == "!cancelled()":
            terms.append(not cancelled)
        else:
            match = re.fullmatch(r"([\w.-]+)\s*==\s*'([^']+)'", term)
            if not match:
                raise AssertionError(f"Unsupported gate expression: {term}")
            terms.append(values.get(match[1]) == match[2])
    return all(terms)


class DeployConditions(unittest.TestCase):
    def setUp(self):
        self.success = dict.fromkeys(
            ["backend", "frontend", "security", "security-regressions", "codeql",
             "security-iac", "security-container"], "success")

    def test_main_push_runs_despite_skipped_pr_only_ancestor(self):
        self.assertTrue(allows("deploy-stage", self.success))
        self.assertIn("github.event_name == 'pull_request'", block("dependency-review"))

    def test_every_required_stage_check_must_succeed(self):
        for job in self.success:
            for result in ("failure", "cancelled", "skipped"):
                with self.subTest(job=job, result=result):
                    self.assertFalse(allows("deploy-stage", self.success | {job: result}))

    def test_no_deploy_on_pr_other_branch_or_cancellation(self):
        for job, results in (("deploy-stage", self.success),
                             ("deploy-production", {"deploy-stage": "success"})):
            with self.subTest(job=job):
                self.assertFalse(allows(job, results, event="pull_request"))
                self.assertFalse(allows(job, results, ref="refs/heads/feature"))
                self.assertFalse(allows(job, results, cancelled=True))

    def test_security_gate_allows_skipped_review_only_on_push(self):
        script = textwrap.dedent(re.search(r"        run: \|\n(.*)", block("security"), re.S)[1])
        checks = ["SECURITY_SCANS", "SECURITY_REGRESSIONS", "CODEQL",
                  "SECURITY_IAC", "SECURITY_CONTAINER"]
        cases = [("push", "skipped", True), ("pull_request", "success", True),
                 ("pull_request", "skipped", False), ("pull_request", "failure", False),
                 ("push", "failure", False), ("push", "cancelled", False)]
        for event, review, expected in cases:
            with self.subTest(event=event, review=review):
                env = os.environ | dict.fromkeys(checks, "success") | {
                    "EVENT_NAME": event, "DEPENDENCY_REVIEW": review}
                result = subprocess.run(["bash", "-c", script], env=env,
                                        capture_output=True, text=True, check=False)
                self.assertEqual(result.returncode == 0, expected, result.stdout)

    def test_production_requires_successful_stage(self):
        self.assertTrue(allows("deploy-production", {"deploy-stage": "success"}))
        for result in ("failure", "cancelled", "skipped"):
            with self.subTest(result=result):
                self.assertFalse(allows("deploy-production", {"deploy-stage": result}))
        self.assertIn("environment: production", block("deploy-production"))


if __name__ == "__main__":
    unittest.main()
