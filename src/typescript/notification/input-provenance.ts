// information_uuid_v5=2f19eacb-01de-5ce1-8c53-6a11bf4cc966
// event_uuid_v7=01a048f8-3326-7152-9e16-1c55a81d7e50
// machine-contract: EXTERNAL_RECEIVED -> SERVER_DERIVED_UNTRUSTED -> SQLITE_AND_AUDIT -> READ_BACK; request bodies cannot self-assert provenance.

export type InputChannel = "WEBMCP" | "LOCAL_FORM" | "TYPED_INTERNAL";
export type SourceTrust = "UNTRUSTED" | "TRUSTED_INTERNAL";
export type InputAnnotation = "UNTRUSTED_LITERAL" | "TRUSTED_INTERNAL";
export type ProvenanceDerivation = "SERVER_ROUTE" | "INTERNAL_CALL";

export interface InputProvenance {
  channel: InputChannel;
  sourceTrust: SourceTrust;
  sourceOrigin: string;
  untrustedContent: boolean;
  annotation: InputAnnotation;
  derivation: ProvenanceDerivation;
}

const FIELDS = Object.freeze([
  "channel",
  "sourceTrust",
  "sourceOrigin",
  "untrustedContent",
  "annotation",
  "derivation",
] as const);

function freeze(value: InputProvenance): Readonly<InputProvenance> {
  return Object.freeze({ ...value });
}

export function assertExpectedOrigin(observed: string | undefined, expected: string): string {
  if (observed !== expected) throw new TypeError(`origin must be ${expected}`);
  const parsed = new URL(observed);
  if (parsed.origin !== observed) throw new TypeError("origin must be canonical");
  return observed;
}

export function externalInputProvenance(
  channel: "WEBMCP" | "LOCAL_FORM",
  observedOrigin: string | undefined,
  expectedOrigin: string,
): Readonly<InputProvenance> {
  const sourceOrigin = assertExpectedOrigin(observedOrigin, expectedOrigin);
  return freeze({
    channel,
    sourceTrust: "UNTRUSTED",
    sourceOrigin,
    untrustedContent: true,
    annotation: "UNTRUSTED_LITERAL",
    derivation: "SERVER_ROUTE",
  });
}

export function internalInputProvenance(): Readonly<InputProvenance> {
  return freeze({
    channel: "TYPED_INTERNAL",
    sourceTrust: "TRUSTED_INTERNAL",
    sourceOrigin: "LOCAL_PROCESS",
    untrustedContent: false,
    annotation: "TRUSTED_INTERNAL",
    derivation: "INTERNAL_CALL",
  });
}

export function projectInputProvenance(value: unknown): Readonly<InputProvenance> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("input provenance must be an object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("input provenance must be a plain object");
  }
  const record = value as Record<string, unknown>;
  const keys = Reflect.ownKeys(record);
  if (keys.some((key) => typeof key !== "string" || !FIELDS.includes(key as typeof FIELDS[number]))) {
    throw new TypeError("input provenance contains an unknown field");
  }
  if (FIELDS.some((field) => !Object.hasOwn(record, field))) {
    throw new TypeError("input provenance is missing a field");
  }

  const descriptors = Object.getOwnPropertyDescriptors(record);
  if (FIELDS.some((field) => {
    const descriptor = descriptors[field];
    return !descriptor || !("value" in descriptor) || descriptor.enumerable !== true;
  })) throw new TypeError("input provenance fields must be enumerable data properties");

  const channel = descriptors.channel!.value;
  const sourceTrust = descriptors.sourceTrust!.value;
  const sourceOrigin = descriptors.sourceOrigin!.value;
  const untrustedContent = descriptors.untrustedContent!.value;
  const annotation = descriptors.annotation!.value;
  const derivation = descriptors.derivation!.value;

  if (channel === "WEBMCP" || channel === "LOCAL_FORM") {
    if (
      sourceTrust !== "UNTRUSTED"
      || typeof sourceOrigin !== "string"
      || untrustedContent !== true
      || annotation !== "UNTRUSTED_LITERAL"
      || derivation !== "SERVER_ROUTE"
    ) throw new TypeError("external input provenance is inconsistent");
    const parsed = new URL(sourceOrigin);
    if (parsed.origin !== sourceOrigin || sourceOrigin.length > 256) {
      throw new TypeError("external source origin must be canonical");
    }
    return freeze({ channel, sourceTrust, sourceOrigin, untrustedContent, annotation, derivation });
  }

  if (
    channel !== "TYPED_INTERNAL"
    || sourceTrust !== "TRUSTED_INTERNAL"
    || sourceOrigin !== "LOCAL_PROCESS"
    || untrustedContent !== false
    || annotation !== "TRUSTED_INTERNAL"
    || derivation !== "INTERNAL_CALL"
  ) throw new TypeError("internal input provenance is inconsistent");
  return freeze({ channel, sourceTrust, sourceOrigin, untrustedContent, annotation, derivation });
}

export function provenanceDetails(value: InputProvenance): Record<string, string | boolean> {
  const provenance = projectInputProvenance(value);
  return {
    inputChannel: provenance.channel,
    sourceTrust: provenance.sourceTrust,
    sourceOrigin: provenance.sourceOrigin,
    untrustedContent: provenance.untrustedContent,
    inputAnnotation: provenance.annotation,
    provenanceDerivation: provenance.derivation,
  };
}

export function provenanceFromDetails(value: unknown): Readonly<InputProvenance> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("provenance details must be an object");
  }
  const record = value as Record<string, unknown>;
  return projectInputProvenance({
    channel: record.inputChannel,
    sourceTrust: record.sourceTrust,
    sourceOrigin: record.sourceOrigin,
    untrustedContent: record.untrustedContent,
    annotation: record.inputAnnotation,
    derivation: record.provenanceDerivation,
  });
}

export function sameProvenance(left: InputProvenance, right: InputProvenance): boolean {
  const a = projectInputProvenance(left);
  const b = projectInputProvenance(right);
  return FIELDS.every((field) => a[field] === b[field]);
}
