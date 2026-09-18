import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export const SCHEMA_VERSION = 1;
export const STATE_DIRECTORY = ".mutant";
export const LEDGER_FILENAME = "ledger.json";

function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw failure("MUTANT_INVALID_INPUT", `${field} is required.`);
  }
  return value.trim();
}

function nowIso() {
  return new Date().toISOString();
}

export function getLedgerPath(cwd = process.cwd()) {
  return join(resolve(cwd), STATE_DIRECTORY, LEDGER_FILENAME);
}

export function validateLedger(ledger) {
  if (!ledger || typeof ledger !== "object") {
    throw failure("MUTANT_INVALID_LEDGER", "Ledger must be a JSON object.");
  }
  if (ledger.schemaVersion !== SCHEMA_VERSION) {
    throw failure(
      "MUTANT_UNSUPPORTED_SCHEMA",
      `Unsupported schema version: ${ledger.schemaVersion ?? "missing"}.`,
    );
  }
  if (!ledger.project || typeof ledger.project.name !== "string") {
    throw failure("MUTANT_INVALID_LEDGER", "Ledger project metadata is missing.");
  }
  if (!Array.isArray(ledger.mutations)) {
    throw failure("MUTANT_INVALID_LEDGER", "Ledger mutations must be an array.");
  }
  return ledger;
}

export function readLedger(cwd = process.cwd()) {
  const target = getLedgerPath(cwd);
  if (!existsSync(target)) {
    throw failure(
      "MUTANT_NOT_INITIALIZED",
      "MUTANT is not initialized here. Run `mutant init` first.",
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(target, "utf8"));
  } catch (error) {
    throw failure("MUTANT_INVALID_LEDGER", `Cannot read ledger: ${error.message}`);
  }
  return validateLedger(parsed);
}

export function writeLedger(cwd, ledger) {
  validateLedger(ledger);
  const target = getLedgerPath(cwd);
  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(ledger, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporary, target);
  return target;
}

export function initLedger(
  cwd = process.cwd(),
  projectName = basename(resolve(cwd)),
  createdAt = nowIso(),
) {
  const target = getLedgerPath(cwd);
  if (existsSync(target)) {
    throw failure("MUTANT_ALREADY_INITIALIZED", `Ledger already exists at ${target}.`);
  }

  const ledger = {
    schemaVersion: SCHEMA_VERSION,
    project: {
      name: requiredText(projectName, "project name"),
      createdAt,
    },
    mutations: [],
  };
  writeLedger(cwd, ledger);
  return ledger;
}

function nextMutationId(mutations) {
  const maximum = mutations.reduce((current, mutation) => {
    const match = /^M-(\d+)$/.exec(mutation.id ?? "");
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `M-${String(maximum + 1).padStart(4, "0")}`;
}

function findMutation(ledger, id) {
  const normalizedId = requiredText(id, "mutation id").toUpperCase();
  const mutation = ledger.mutations.find((item) => item.id === normalizedId);
  if (!mutation) {
    throw failure("MUTANT_NOT_FOUND", `Mutation ${normalizedId} was not found.`);
  }
  return mutation;
}

export function proposeMutation(cwd, input, createdAt = nowIso()) {
  const ledger = readLedger(cwd);
  const mutation = {
    id: nextMutationId(ledger.mutations),
    title: requiredText(input.title, "title"),
    problem: requiredText(input.problem, "problem"),
    hypothesis: requiredText(input.hypothesis, "hypothesis"),
    metric: requiredText(input.metric, "metric"),
    status: "proposed",
    createdAt,
    updatedAt: createdAt,
    evidence: [],
    decision: null,
  };
  ledger.mutations.push(mutation);
  writeLedger(cwd, ledger);
  return mutation;
}

export function recordEvidence(cwd, id, input, recordedAt = nowIso()) {
  const ledger = readLedger(cwd);
  const mutation = findMutation(ledger, id);
  const evidence = {
    note: requiredText(input.note, "evidence note"),
    source: typeof input.source === "string" && input.source.trim()
      ? input.source.trim()
      : null,
    recordedAt,
  };
  mutation.evidence.push(evidence);
  mutation.updatedAt = recordedAt;
  writeLedger(cwd, ledger);
  return { mutation, evidence };
}

export function decideMutation(cwd, id, outcome, reason, decidedAt = nowIso()) {
  const ledger = readLedger(cwd);
  const mutation = findMutation(ledger, id);
  if (mutation.status !== "proposed") {
    throw failure(
      "MUTANT_ALREADY_DECIDED",
      `Mutation ${mutation.id} is already ${mutation.status}.`,
    );
  }
  if (!mutation.evidence.length) {
    throw failure(
      "MUTANT_EVIDENCE_REQUIRED",
      `Mutation ${mutation.id} needs evidence before a decision.`,
    );
  }
  if (!new Set(["accepted", "rejected"]).has(outcome)) {
    throw failure("MUTANT_INVALID_INPUT", "Outcome must be accepted or rejected.");
  }

  mutation.status = outcome;
  mutation.decision = {
    outcome,
    reason: requiredText(reason, "decision reason"),
    decidedAt,
  };
  mutation.updatedAt = decidedAt;
  writeLedger(cwd, ledger);
  return mutation;
}

export function getMutation(cwd, id) {
  return findMutation(readLedger(cwd), id);
}

export function listMutations(cwd, status = null) {
  const ledger = readLedger(cwd);
  if (!status) return ledger.mutations;
  if (!new Set(["proposed", "accepted", "rejected"]).has(status)) {
    throw failure("MUTANT_INVALID_INPUT", `Unknown status: ${status}.`);
  }
  return ledger.mutations.filter((mutation) => mutation.status === status);
}

function inline(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, " ");
}

export function renderMarkdown(ledger) {
  validateLedger(ledger);
  const lines = [
    `# ${ledger.project.name} mutation ledger`,
    "",
    `Schema version: ${ledger.schemaVersion}`,
    "",
  ];

  if (!ledger.mutations.length) {
    lines.push("No mutations recorded.", "");
    return lines.join("\n");
  }

  lines.push("| ID | Status | Mutation | Success metric |", "|---|---|---|---|");
  for (const mutation of ledger.mutations) {
    lines.push(
      `| ${mutation.id} | ${mutation.status} | ${inline(mutation.title)} | ${inline(mutation.metric)} |`,
    );
  }
  lines.push("");

  for (const mutation of ledger.mutations) {
    lines.push(
      `## ${mutation.id} — ${mutation.title}`,
      "",
      `**Status:** ${mutation.status}`,
      "",
      `**Problem:** ${mutation.problem}`,
      "",
      `**Hypothesis:** ${mutation.hypothesis}`,
      "",
      `**Success metric:** ${mutation.metric}`,
      "",
      "### Evidence",
      "",
    );
    if (!mutation.evidence.length) {
      lines.push("No evidence recorded.", "");
    } else {
      for (const evidence of mutation.evidence) {
        const source = evidence.source ? ` ([source](${evidence.source}))` : "";
        lines.push(`- ${evidence.note}${source} — ${evidence.recordedAt}`);
      }
      lines.push("");
    }
    if (mutation.decision) {
      lines.push(
        "### Decision",
        "",
        `**${mutation.decision.outcome}:** ${mutation.decision.reason}`,
        "",
      );
    }
  }

  return lines.join("\n");
}

