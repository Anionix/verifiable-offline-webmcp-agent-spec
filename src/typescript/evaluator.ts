import type { CanonicalIR, Decision, Gates } from "./types.ts";

const SCALE = 1_000_000n;

function safeBigInt(value: number, label: string): bigint {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be a safe integer`);
  return BigInt(value);
}

export function allHardGatesPass(g: Gates): boolean {
  return g.schema && g.auth && g.permission && g.network && g.version &&
    g.dependency && g.privacy && g.consent;
}

export function utilityAllowsCall(ir: CanonicalIR): boolean {
  const u = ir.utility;
  const p = safeBigInt(u.successProbabilityPPM, "successProbabilityPPM");
  const gain = safeBigInt(u.successGain, "successGain");
  const loss = safeBigInt(u.failureLoss, "failureLoss");
  const penalty = safeBigInt(u.totalPenalty, "totalPenalty");
  const abstain = safeBigInt(u.abstainUtility, "abstainUtility");
  return p * (gain + loss) > SCALE * (penalty + loss + abstain);
}

export function verificationPass(ir: CanonicalIR): boolean {
  const v = ir.verification;
  if (v.confidencePPM === null) return false;
  if (v.confidencePPM < v.classFloorPPM) return false;
  if (v.damage === null || v.lossBudget === null) return false;
  if (v.damage <= 0) return true;
  const confidence = safeBigInt(v.confidencePPM, "confidencePPM");
  const damage = safeBigInt(v.damage, "damage");
  const budget = safeBigInt(v.lossBudget, "lossBudget");
  return (SCALE - confidence) * damage <= SCALE * budget;
}

export function evaluatePre(ir: CanonicalIR): Decision {
  if (ir.phase !== "pre") throw new TypeError("evaluatePre requires phase=pre");
  if (!allHardGatesPass(ir.gates)) return "DENY";
  if (ir.state.ambiguousPreviousEffect) return "RECONCILE";
  if (ir.state.humanRequired) return "HUMAN";
  return utilityAllowsCall(ir) ? "ALLOW" : "DENY";
}

export function evaluatePost(ir: CanonicalIR): Decision {
  if (ir.phase !== "post") throw new TypeError("evaluatePost requires phase=post");
  if (!allHardGatesPass(ir.gates)) return "DENY";
  if (ir.state.ambiguousPreviousEffect) return "RECONCILE";
  if (ir.state.humanRequired) return "HUMAN";
  return verificationPass(ir) ? "ALLOW" : "DENY";
}

export function evaluate(ir: CanonicalIR): Decision {
  return ir.phase === "pre" ? evaluatePre(ir) : evaluatePost(ir);
}
