import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  decideMutation,
  getLedgerPath,
  initLedger,
  proposeMutation,
  readLedger,
  recordEvidence,
  renderMarkdown,
} from "../src/ledger.js";

function project(t) {
  const directory = mkdtempSync(join(tmpdir(), "mutant-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("initializes an auditable ledger", (t) => {
  const directory = project(t);
  const ledger = initLedger(directory, "example", "2026-09-18T00:00:00.000Z");

  assert.equal(ledger.project.name, "example");
  assert.equal(ledger.schemaVersion, 1);
  assert.deepEqual(ledger.mutations, []);
  assert.equal(readLedger(directory).project.name, "example");
  assert.match(readFileSync(getLedgerPath(directory), "utf8"), /"schemaVersion": 1/);
});

test("records a proposal, evidence, and an evidence-backed decision", (t) => {
  const directory = project(t);
  initLedger(directory, "example", "2026-09-18T00:00:00.000Z");
  const mutation = proposeMutation(
    directory,
    {
      title: "Make failures explicit",
      problem: "Silent failures hide broken workflows.",
      hypothesis: "Structured errors reduce diagnosis time.",
      metric: "Median diagnosis time falls below five minutes.",
    },
    "2026-09-18T00:01:00.000Z",
  );

  assert.equal(mutation.id, "M-0001");
  recordEvidence(
    directory,
    mutation.id,
    { note: "Three testers found the failure in under four minutes.", source: "https://example.test/evidence" },
    "2026-09-18T00:02:00.000Z",
  );
  const decided = decideMutation(
    directory,
    mutation.id,
    "accepted",
    "The observed result beats the target.",
    "2026-09-18T00:03:00.000Z",
  );

  assert.equal(decided.status, "accepted");
  assert.equal(decided.evidence.length, 1);
  assert.equal(decided.decision.outcome, "accepted");
});

test("refuses a decision without evidence", (t) => {
  const directory = project(t);
  initLedger(directory, "example");
  const mutation = proposeMutation(directory, {
    title: "A proposal",
    problem: "A real problem",
    hypothesis: "A testable hypothesis",
    metric: "A measurable result",
  });

  assert.throws(
    () => decideMutation(directory, mutation.id, "accepted", "No proof yet."),
    (error) => error.code === "MUTANT_EVIDENCE_REQUIRED",
  );
});

test("exports a readable Markdown record", (t) => {
  const directory = project(t);
  initLedger(directory, "example");
  proposeMutation(directory, {
    title: "A visible mutation",
    problem: "Decisions disappear.",
    hypothesis: "A ledger preserves context.",
    metric: "Every accepted change links to evidence.",
  });

  const markdown = renderMarkdown(readLedger(directory));
  assert.match(markdown, /^# example mutation ledger/m);
  assert.match(markdown, /M-0001/);
  assert.match(markdown, /Every accepted change links to evidence/);
});

test("CLI completes the first proposal flow", (t) => {
  const directory = project(t);
  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], {
    cwd: directory,
    encoding: "utf8",
  });

  assert.equal(run("init", "--name", "cli-example").status, 0);
  const proposed = run(
    "propose",
    "--title", "Test the CLI",
    "--problem", "The flow is unverified.",
    "--hypothesis", "An integration test catches regressions.",
    "--metric", "The command exits successfully.",
  );
  assert.equal(proposed.status, 0, proposed.stderr);
  assert.match(proposed.stdout, /M-0001/);

  const listed = run("list", "--json");
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(JSON.parse(listed.stdout)[0].title, "Test the CLI");
});

