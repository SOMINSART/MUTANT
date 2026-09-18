# MUTANT prototype brief

> **Status:** proposed product direction, implemented on an experimental branch for public review.

## One sentence

**MUTANT helps builders and small teams transform uncertain change ideas into evidence-backed decisions by recording each proposal, success metric, observation, and outcome in a portable local ledger.**

## First user

A developer, designer, researcher, or small team that changes a project frequently and wants an honest record of why a change was proposed, what evidence appeared, and why the change was accepted or rejected.

## Problem

Project histories usually preserve *what* changed but lose the hypothesis and evidence behind the decision. Roadmaps then become lists of promises, and rejected experiments disappear even when they contain useful learning.

## Smallest useful transformation

Input:

- a named problem;
- a testable hypothesis;
- an observable success metric;
- evidence gathered after trying the change.

Output:

- a versionable JSON mutation ledger;
- an explicit proposed, accepted, or rejected state;
- a human-readable Markdown export.

## Core rule

MUTANT refuses to accept or reject a proposal until at least one piece of evidence has been recorded.

## Prototype commands

```bash
mutant init --name my-project

mutant propose \
  --title "Shorten onboarding" \
  --problem "New users abandon setup" \
  --hypothesis "A three-step flow improves completion" \
  --metric "At least 70% complete setup"

mutant evidence M-0001 \
  --note "14 of 18 testers completed setup" \
  --source "https://example.com/research"

mutant decide M-0001 --accept \
  --reason "Completion reached 78%, above the target"

mutant export --output MUTATIONS.md
```

## Data model

The prototype writes `.mutant/ledger.json` inside the current project. It contains project metadata and mutation records. It performs no network request, collects no telemetry, and requires no account.

## Non-goals for the prototype

- Autonomous source-code mutation.
- AI-generated decisions.
- A hosted SaaS product.
- User accounts, cloud synchronization, or billing.
- Replacing Git, issues, experiments, or peer review.
- Claiming that recorded evidence is automatically trustworthy.

## Success criterion

Five external users can initialize a ledger, record one proposal, attach evidence, decide it, and export the history without maintainer assistance or data loss.

## Risks to test

- Users may treat low-quality evidence as proof.
- A mutable JSON file is not a tamper-proof audit log.
- Concurrent writers can conflict.
- The vocabulary may feel too formal for small changes.
- Evidence URLs may expose private information if users are careless.

## Decision gate

This direction should move from “proposed” to “accepted” only after the maintainer approves the product definition and external users demonstrate that the workflow solves a real problem.

