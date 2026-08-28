#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import deque
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass(frozen=True)
class State:
    pc: str
    auth: bool
    verified: bool
    ambiguous: bool
    effect_count: int
    retry_left: int


def successors(s: State, mutation: str | None = None):
    out: list[tuple[str, State]] = []
    def add(label: str, **kw):
        d = asdict(s)
        d.update(kw)
        out.append((label, State(**d)))

    if s.pc == "PRE":
        add("Authorize", pc="AUTHORIZED", auth=True)
        add("Deny", pc="DENIED")
        if mutation == "unauthorized":
            add("BrokenUnauthorizedStart", pc="EXECUTING", auth=False)

    if s.pc == "AUTHORIZED" and (s.auth or mutation == "unauthorized"):
        add("StartExecution", pc="EXECUTING")
        add("Expire", pc="EXPIRED")

    if s.pc == "EXECUTING":
        if s.effect_count == 0 or (mutation == "double" and s.effect_count < 2):
            add("ExecutionSuccess", pc="SUCCEEDED", effect_count=s.effect_count + 1, ambiguous=False)
            add("ExecutionUnknownWithEffect", pc="AMBIGUOUS", effect_count=s.effect_count + 1, ambiguous=True)
        add("ExecutionFailure", pc="FAILED")
        if s.effect_count == 0:
            add("ExecutionUnknownNoEffect", pc="AMBIGUOUS", ambiguous=True)

    if s.pc == "AMBIGUOUS":
        add("BeginReconcile", pc="RECONCILING")
        if mutation == "ambiguous-retry":
            add("BrokenAmbiguousRetry", pc="EXECUTING")

    if s.pc == "RECONCILING":
        if s.effect_count == 1:
            add("ReconcileEffectFound", pc="SUCCEEDED", ambiguous=False)
        if s.effect_count == 0:
            add("ReconcileNoEffect", pc="FAILED", ambiguous=False)

    if s.pc == "FAILED" and s.auth and s.retry_left > 0:
        if s.effect_count == 0 or mutation == "double":
            add("Retry", pc="AUTHORIZED", retry_left=s.retry_left - 1)

    if s.pc == "SUCCEEDED":
        add("BeginVerify", pc="VERIFYING")
        if mutation == "double" and s.effect_count < 2:
            add("BrokenRetryAfterSuccess", pc="AUTHORIZED")
        if mutation == "commit-bypass":
            add("BrokenCommitBypass", pc="COMMITTED", verified=False)

    if s.pc == "VERIFYING" and s.effect_count == 1:
        add("Verify", pc="VERIFIED", verified=True)

    if s.pc == "VERIFIED" and s.verified:
        add("Commit", pc="COMMITTED")

    return out


def explore(max_retry: int, mutation: str | None = None):
    start = State("PRE", False, False, False, 0, max_retry)
    q = deque([start])
    seen = {start}
    edges: list[tuple[State, str, State]] = []
    while q:
        s = q.popleft()
        for label, t in successors(s, mutation):
            edges.append((s, label, t))
            if t not in seen:
                seen.add(t)
                q.append(t)
    return seen, edges


def evaluate(max_retry: int, mutation: str | None = None):
    states, edges = explore(max_retry, mutation)
    unauthorized = [asdict(s) for s in states if s.pc == "EXECUTING" and not s.auth]
    double = [asdict(s) for s in states if s.effect_count > 1]
    bypass = [asdict(s) for s in states if s.pc == "COMMITTED" and not s.verified]
    ambiguous_retry = [
        {"from": asdict(a), "label": label, "to": asdict(b)}
        for a, label, b in edges
        if a.ambiguous and b.pc in {"AUTHORIZED", "EXECUTING"}
    ]
    return {
        "mutation": mutation,
        "reachableStateCount": len(states),
        "transitionCount": len(edges),
        "unauthorizedExecuteCount": len(unauthorized),
        "doubleEffectCount": len(double),
        "commitWithoutVerificationCount": len(bypass),
        "ambiguousRetryEdgeCount": len(ambiguous_retry),
        "commitReachable": any(s.pc == "COMMITTED" for s in states),
        "counterexamples": {
            "unauthorizedExecute": unauthorized[:3],
            "doubleEffect": double[:3],
            "commitWithoutVerification": bypass[:3],
            "ambiguousRetry": ambiguous_retry[:3],
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path)
    ap.add_argument("--max-retry", type=int, default=2)
    args = ap.parse_args()
    baseline = evaluate(args.max_retry)
    mutations = {
        name: evaluate(args.max_retry, name)
        for name in ["unauthorized", "double", "commit-bypass", "ambiguous-retry"]
    }
    report = {
        "model": "finite EFSM abstraction",
        "maxRetry": args.max_retry,
        "baseline": baseline,
        "mutations": mutations,
        "passed": (
            baseline["unauthorizedExecuteCount"] == 0
            and baseline["doubleEffectCount"] == 0
            and baseline["commitWithoutVerificationCount"] == 0
            and baseline["ambiguousRetryEdgeCount"] == 0
            and baseline["commitReachable"]
            and mutations["unauthorized"]["unauthorizedExecuteCount"] > 0
            and mutations["double"]["doubleEffectCount"] > 0
            and mutations["commit-bypass"]["commitWithoutVerificationCount"] > 0
            and mutations["ambiguous-retry"]["ambiguousRetryEdgeCount"] > 0
        ),
    }
    text = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")
    print(text, end="")
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
