# Audit sample data

The event stream is synthetic and signed with ephemeral keys created during artifact generation. Only public keys are included. `tamper-report.json` shows that modifying event 2 changes that event and every subsequent chain hash, changes the Merkle root, and invalidates signatures.
