#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decideMutation,
  getMutation,
  initLedger,
  listMutations,
  proposeMutation,
  readLedger,
  recordEvidence,
  renderMarkdown,
} from "./ledger.js";

const HELP = `MUTANT — evidence-driven project evolution

Usage:
  mutant init [--name <project>]
  mutant propose --title <text> --problem <text> --hypothesis <text> --metric <text>
  mutant evidence <id> --note <text> [--source <url>]
  mutant decide <id> (--accept | --reject) --reason <text>
  mutant list [--status proposed|accepted|rejected] [--json]
  mutant show <id> [--json]
  mutant export [--output <file>]

Principle:
  No mutation is accepted or rejected without recorded evidence.
`;

function parseArguments(raw) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < raw.length; index += 1) {
    const value = raw[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const equals = value.indexOf("=");
    if (equals > 2) {
      flags[value.slice(2, equals)] = value.slice(equals + 1);
      continue;
    }
    const key = value.slice(2);
    const next = raw[index + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }
  return { positional, flags };
}

function printMutation(mutation) {
  console.log(`${mutation.id} [${mutation.status}] ${mutation.title}`);
  console.log(`Problem: ${mutation.problem}`);
  console.log(`Hypothesis: ${mutation.hypothesis}`);
  console.log(`Metric: ${mutation.metric}`);
  console.log(`Evidence: ${mutation.evidence.length}`);
  if (mutation.decision) {
    console.log(`Decision: ${mutation.decision.outcome} — ${mutation.decision.reason}`);
  }
}

function run() {
  const { positional, flags } = parseArguments(process.argv.slice(2));
  const [command, id] = positional;
  const cwd = process.cwd();

  if (!command || command === "help" || flags.help || command === "--help") {
    console.log(HELP);
    return;
  }

  switch (command) {
    case "init": {
      const ledger = initLedger(cwd, flags.name);
      console.log(`Initialized MUTANT for ${ledger.project.name}.`);
      break;
    }
    case "propose": {
      const mutation = proposeMutation(cwd, {
        title: flags.title,
        problem: flags.problem,
        hypothesis: flags.hypothesis,
        metric: flags.metric,
      });
      console.log(`Proposed ${mutation.id}: ${mutation.title}`);
      break;
    }
    case "evidence": {
      const result = recordEvidence(cwd, id, {
        note: flags.note,
        source: flags.source,
      });
      console.log(`Recorded evidence for ${result.mutation.id}.`);
      break;
    }
    case "decide": {
      if (Boolean(flags.accept) === Boolean(flags.reject)) {
        throw new Error("Choose exactly one of --accept or --reject.");
      }
      const mutation = decideMutation(
        cwd,
        id,
        flags.accept ? "accepted" : "rejected",
        flags.reason,
      );
      console.log(`${mutation.id} ${mutation.status}.`);
      break;
    }
    case "list": {
      const mutations = listMutations(cwd, flags.status || null);
      if (flags.json) {
        console.log(JSON.stringify(mutations, null, 2));
      } else if (!mutations.length) {
        console.log("No matching mutations.");
      } else {
        for (const mutation of mutations) {
          console.log(`${mutation.id}\t${mutation.status}\t${mutation.title}`);
        }
      }
      break;
    }
    case "show": {
      const mutation = getMutation(cwd, id);
      if (flags.json) console.log(JSON.stringify(mutation, null, 2));
      else printMutation(mutation);
      break;
    }
    case "export": {
      const markdown = renderMarkdown(readLedger(cwd));
      if (flags.output) {
        const destination = resolve(cwd, flags.output);
        writeFileSync(destination, `${markdown}\n`, "utf8");
        console.log(`Exported mutation ledger to ${destination}.`);
      } else {
        console.log(markdown);
      }
      break;
    }
    default:
      throw new Error(`Unknown command: ${command}. Run mutant --help.`);
  }
}

try {
  run();
} catch (error) {
  console.error(`MUTANT: ${error.message}`);
  process.exitCode = 1;
}

