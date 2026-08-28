# TLA+ model

`ToolExecution.tla` is the normative abstract behavior specification. `ToolExecution.cfg` configures a small finite model.

The repository does not bundle `tla2tools.jar`; local validation runs the independent Python finite-state explorer. To run TLC, install the official TLA+ tools and execute:

```bash
java -cp tla2tools.jar tlc2.TLC -config ToolExecution.cfg ToolExecution.tla
```

Expected safety invariants: no unauthorized execution, no double effect, no unverified commit, no ambiguous retry, and effect requires authorization.
