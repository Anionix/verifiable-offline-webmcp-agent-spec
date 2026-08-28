# Wolfram reference model

`ReferenceModel.wl` contains symbolic/reference functions for policy thresholds, retry geometry, reliability, and probability mass. `verification-report.json` records formulas evaluated through a Wolfram Language kernel during the original artifact generation.

No Wolfram runtime was available for the 1.0.0 final-evidence run, so the current execution status is explicitly `NOT_EXECUTED`. The captured report remains `CONFIRMED`, and `scripts/final_verification.py` independently reproduces its sample with exact Python `Fraction` arithmetic. Production code does not depend on Wolfram.
