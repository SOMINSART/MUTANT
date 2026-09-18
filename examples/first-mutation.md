# Example: one MUTANT cycle

```text
$ mutant init --name demo
Initialized MUTANT for demo.

$ mutant propose --title "Make failures explicit" \
    --problem "Silent failures hide broken workflows" \
    --hypothesis "Structured errors reduce diagnosis time" \
    --metric "Median diagnosis time falls below five minutes"
Proposed M-0001: Make failures explicit

$ mutant evidence M-0001 \
    --note "Three testers diagnosed the failure in under four minutes"
Recorded evidence for M-0001.

$ mutant decide M-0001 --accept \
    --reason "Observed diagnosis time beat the target"
M-0001 accepted.

$ mutant export
# demo mutation ledger
...
```

The important output is not “accepted.” It is the preserved connection between the original problem, the hypothesis, the success metric, the evidence, and the final decision.

