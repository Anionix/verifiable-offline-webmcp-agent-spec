// information_uuid_v5=ca171f50-2e56-5689-852c-d9b2be3bfa07
// event_uuid_v7=01a04872-0599-7641-a222-e5a4918830ca
// machine-contract: DRY_RUN -> USER_APPROVED -> EXECUTING -> VERIFIED; this benchmark never calls a real notification adapter.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { uuidV5, uuidV7 } from "../uuid.ts";
import { AuditLog } from "./audit-log.ts";
import { NotificationEngine } from "./engine.ts";
import { SimulatedNotificationAdapter } from "./simulated-adapter.ts";
import { NotificationStore } from "./store.ts";
import { ROOT_UUID_NAMESPACE } from "./types.ts";

const SAMPLE_COUNT = 100;
const LIMIT_MS = 2_000;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

interface Sample {
  benchmarkId: string;
  runEventId: string;
  sample: number;
  logicalOperationId: string;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  outcome: string;
}

function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]!;
}

function pathArgument(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return resolve(index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback);
}

async function main(): Promise<void> {
  const samplesPath = pathArgument("--samples", ".local/notification-latency.ndjson");
  const summaryPath = pathArgument("--summary", ".local/notification-latency-summary.json");
  const directory = mkdtempSync(join(tmpdir(), "notification-benchmark-"));
  const store = new NotificationStore(join(directory, "queue.sqlite"));
  const audit = new AuditLog(join(directory, "audit.ndjson"));
  const engine = new NotificationEngine({ store, audit });
  const adapter = new SimulatedNotificationAdapter("success");
  const benchmarkId = uuidV5(ROOT_UUID_NAMESPACE, "benchmark/notification-approval-to-result-100");
  const runEventId = uuidV7(Date.now());
  const samples: Sample[] = [];

  try {
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const logicalOperationId = `benchmark-${runEventId}-${index}`;
      const intent = engine.createIntent({
        logicalOperationId,
        title: "模擬通知",
        body: "外部効果を起こさない遅延測定です。",
      });
      await engine.preview(intent.intentId, adapter);
      engine.approve(intent.intentId);
      const started = Date.now();
      const highResolutionStart = performance.now();
      const result = await engine.execute(intent.intentId, adapter);
      const latencyMs = performance.now() - highResolutionStart;
      const finished = Date.now();
      if (result.status !== "VERIFIED") throw new Error(`unexpected benchmark outcome: ${result.status}`);
      samples.push({
        benchmarkId,
        runEventId,
        sample: index + 1,
        logicalOperationId,
        startedAt: new Date(started).toISOString(),
        finishedAt: new Date(finished).toISOString(),
        latencyMs: Number(latencyMs.toFixed(6)),
        outcome: result.status,
      });
    }

    const latencies = samples.map((sample) => sample.latencyMs).sort((left, right) => left - right);
    const summary = {
      benchmarkId,
      runEventId,
      measuredAt: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: platform(),
        platformRelease: release(),
        architecture: arch(),
        adapter: "SimulatedNotificationAdapter(success)",
        externalServiceCostYen: 0,
      },
      sampleCount: samples.length,
      medianMs: Number(percentile(latencies, 0.5).toFixed(6)),
      p95Ms: Number(percentile(latencies, 0.95).toFixed(6)),
      maximumMs: Number(latencies.at(-1)!.toFixed(6)),
      thresholdP95Ms: LIMIT_MS,
      passed: percentile(latencies, 0.95) <= LIMIT_MS,
      samplesPath: relative(repositoryRoot, samplesPath),
      evidenceState: "CONFIRMED",
    };

    mkdirSync(dirname(samplesPath), { recursive: true });
    mkdirSync(dirname(summaryPath), { recursive: true });
    writeFileSync(samplesPath, `${samples.map((sample) => JSON.stringify(sample)).join("\n")}\n`, "utf8");
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (!summary.passed) process.exitCode = 1;
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

await main();
