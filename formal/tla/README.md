# TLA+ model

`ToolExecution.tla` is the normative abstract behavior specification. `ToolExecution.cfg` configures a small finite model. `DENIED`, `EXPIRED`, and `COMMITTED` are intentional terminal states, so the configuration sets `CHECK_DEADLOCK FALSE`; all listed safety invariants remain enabled.

The repository does not bundle `tla2tools.jar`; local validation runs the independent Python finite-state explorer and checks the captured TLC report. The final public-evidence run used the official TLA+ Tools v1.7.4 release and completed with 44 generated states, 38 distinct states, zero states left, graph depth 13, and no invariant error. The machine-readable record is [`verification-report.json`](verification-report.json).

To reproduce the same semantic result with the official binary, execute:

```bash
make verify-tla TLA2TOOLS_JAR=/absolute/path/to/tla2tools.jar
```

Expected safety invariants: no unauthorized execution, no double effect, no unverified commit, no ambiguous retry, and effect requires authorization.

The replay command uses one worker, fingerprint implementation 0, and a fresh temporary state directory. Before starting Java, it requires the downloaded `tla2tools.jar` to match both the SHA-1 published on the [official v1.7.4 release](https://github.com/tlaplus/tlaplus/releases/tag/v1.7.4) and the captured SHA-256. `make validate` does not start Java; it checks the captured report, current TLA+ source digests, the independent 38-state explorer, and the final evidence byte for byte.
