export type Decision = "ALLOW" | "DENY" | "HUMAN" | "RECONCILE";
export type Phase = "pre" | "post";

export interface Gates {
  schema: boolean;
  auth: boolean;
  permission: boolean;
  network: boolean;
  version: boolean;
  dependency: boolean;
  privacy: boolean;
  consent: boolean;
}

export interface CanonicalIR {
  irVersion: "0.1.0";
  identity: Record<string, unknown>;
  temporal: Record<string, unknown>;
  tool: { id: string; class: string; contractVersion: string };
  phase: Phase;
  gates: Gates;
  state: { ambiguousPreviousEffect: boolean; humanRequired: boolean };
  utility: {
    successProbabilityPPM: number;
    successGain: number;
    failureLoss: number;
    totalPenalty: number;
    abstainUtility: number;
  };
  verification: {
    confidencePPM: number | null;
    classFloorPPM: number;
    damage: number | null;
    lossBudget: number | null;
  };
}
