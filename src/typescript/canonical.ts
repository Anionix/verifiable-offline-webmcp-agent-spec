export type CanonicalValue = null | boolean | string | number | CanonicalValue[] | { [key: string]: CanonicalValue };

export function canonicalJson(value: CanonicalValue): string {
  assertSubset(value);
  return serialize(value);
}

function assertSubset(value: CanonicalValue): void {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || Object.is(value, -0))) {
    throw new TypeError("audit canonical subset permits safe integers only");
  }
  if (Array.isArray(value)) value.forEach(assertSubset);
  else if (value !== null && typeof value === "object") Object.values(value).forEach(assertSubset);
}

function serialize(value: CanonicalValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(serialize).join(",")}]`;
  const entries = Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${serialize(value[k]!)}`);
  return `{${entries.join(",")}}`;
}
