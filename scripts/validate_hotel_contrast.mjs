#!/usr/bin/env node
// information_uuid_v5=9cede17a-b567-5cf7-bfc4-181d7b7e77b6
// event_uuid_v7=01a053a2-1f4f-7c66-bc42-493b9634f4d1 state_transition=CONTRAST_OBSERVED -> CONTRAST_THRESHOLDS_ENFORCED occurred_at=2026-08-30T17:05:28.911Z
// machine-contract: resolve the displayed CSS colors, composite the declared body gradients and translucent panels, and calculate unrounded W3C contrast ratios.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const css = await readFile(resolve(repositoryRoot, "examples/hotel-booking-demo/styles.css"), "utf8");
const variables = new Map([...css.matchAll(/(?<name>--[\w-]+)\s*:\s*(?<value>[^;]+);/gu)].map(({ groups }) => [groups.name, groups.value.trim()]));
const ruleMatches = [...css.matchAll(/(?<selectors>[^{}]+)\{(?<declarations>[^{}]*)\}/gu)];

function findRule(selector) {
  for (const { groups } of ruleMatches) {
    const selectors = groups.selectors
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .split(",")
      .map((item) => item.trim());
    if (selectors.includes(selector)) return groups.declarations;
  }
  assert.fail(`CSS selector is missing: ${selector}`);
}

function declaration(selector, property) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(`(?:^|;)\\s*${escapedProperty}\\s*:\\s*([^;]+)`, "u").exec(findRule(selector));
  assert.ok(match, `${property} declaration is missing for ${selector}`);
  return match[1].trim();
}

function resolveCssValue(value, seen = new Set()) {
  const trimmed = value.trim();
  const variable = /^var\((--[\w-]+)\)$/u.exec(trimmed);
  if (!variable) return trimmed;
  const name = variable[1];
  assert.ok(!seen.has(name), `cyclic CSS variable: ${name}`);
  assert.ok(variables.has(name), `CSS variable is missing: ${name}`);
  const nextSeen = new Set(seen);
  nextSeen.add(name);
  return resolveCssValue(variables.get(name), nextSeen);
}

function parseColor(value) {
  const resolved = resolveCssValue(value);
  const hex = /^#(?<digits>[\da-f]{6})$/iu.exec(resolved);
  if (hex) {
    return {
      r: Number.parseInt(hex.groups.digits.slice(0, 2), 16),
      g: Number.parseInt(hex.groups.digits.slice(2, 4), 16),
      b: Number.parseInt(hex.groups.digits.slice(4, 6), 16),
      a: 1,
    };
  }
  const rgb = /^rgba?\(\s*(?<r>\d+(?:\.\d+)?)\s*,\s*(?<g>\d+(?:\.\d+)?)\s*,\s*(?<b>\d+(?:\.\d+)?)(?:\s*,\s*(?<a>\d*\.?\d+))?\s*\)$/u.exec(resolved);
  if (rgb) {
    return {
      r: Number(rgb.groups.r),
      g: Number(rgb.groups.g),
      b: Number(rgb.groups.b),
      a: rgb.groups.a === undefined ? 1 : Number(rgb.groups.a),
    };
  }
  if (resolved === "white") return { r: 255, g: 255, b: 255, a: 1 };
  if (resolved === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  assert.fail(`unsupported CSS color: ${value}`);
}

function composite(source, backdrop) {
  const alpha = source.a + backdrop.a * (1 - source.a);
  return {
    r: (source.r * source.a + backdrop.r * backdrop.a * (1 - source.a)) / alpha,
    g: (source.g * source.a + backdrop.g * backdrop.a * (1 - source.a)) / alpha,
    b: (source.b * source.a + backdrop.b * backdrop.a * (1 - source.a)) / alpha,
    a: alpha,
  };
}

function interpolate(first, second, fraction) {
  return {
    r: first.r + (second.r - first.r) * fraction,
    g: first.g + (second.g - first.g) * fraction,
    b: first.b + (second.b - first.b) * fraction,
    a: 1,
  };
}

function relativeLuminance(color) {
  const linear = [color.r, color.g, color.b].map((component) => {
    const channel = component / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

function weakestContrast(foreground, backgrounds) {
  return backgrounds.reduce(
    (weakest, background) => {
      const ratio = contrastRatio(foreground, background);
      return ratio < weakest.ratio ? { ratio, background } : weakest;
    },
    { ratio: Number.POSITIVE_INFINITY, background: null },
  );
}

function sampledRgbRange(colors) {
  return Object.fromEntries(
    ["r", "g", "b"].map((channel) => [
      channel,
      { min: Math.min(...colors.map((color) => color[channel])), max: Math.max(...colors.map((color) => color[channel])) },
    ]),
  );
}

const colorToken = String.raw`(?:var\(--[\w-]+\)|rgba?\([^)]*\)|#[\da-fA-F]{3,8})`;
const bodyBackground = declaration("body", "background");
const radialGradient = new RegExp(`radial-gradient\\([^,]+,\\s*(${colorToken})\\s*,\\s*transparent[^)]*\\)`, "u").exec(bodyBackground);
const linearGradient = new RegExp(`linear-gradient\\([^,]+,\\s*(${colorToken})\\s+0%\\s*,\\s*(${colorToken})\\s+100%\\)`, "u").exec(bodyBackground);
assert.ok(radialGradient, "body radial gradient is missing");
assert.ok(linearGradient, "body linear gradient is missing");

const radialColor = parseColor(radialGradient[1]);
const bodyStart = parseColor(linearGradient[1]);
const bodyEnd = parseColor(linearGradient[2]);
const bodyBackgrounds = [];
for (let baseStep = 0; baseStep <= 100; baseStep += 1) {
  const base = interpolate(bodyStart, bodyEnd, baseStep / 100);
  for (let radialStep = 0; radialStep <= 100; radialStep += 1) {
    bodyBackgrounds.push(composite({ ...radialColor, a: (radialColor.a * radialStep) / 100 }, base));
  }
}

const panelColor = parseColor(declaration(".status-card", "background"));
const panelBackgrounds = bodyBackgrounds.map((background) => composite(panelColor, background));
const relevantBackgrounds = [...bodyBackgrounds, ...panelBackgrounds];
const sampledBackgroundRange = sampledRgbRange(relevantBackgrounds);

const smallTextResults = [".eyebrow", ".step-label"].map((selector) => {
  const foreground = parseColor(declaration(selector, "color"));
  const weakest = weakestContrast(foreground, relevantBackgrounds);
  assert.ok(weakest.ratio >= 4.5, `${selector} contrast is below 4.5:1 (${weakest.ratio})`);
  return { selector, foreground, sampledMinimumContrast: weakest.ratio };
});

const focusSelectors = ["button:focus-visible", "input:focus-visible", "select:focus-visible", "summary:focus-visible", "a:focus-visible"];
const focusResults = focusSelectors.map((selector) => {
  const outline = declaration(selector, "outline");
  const outlineParts = /^(?<width>\d+(?:\.\d+)?)px\s+solid\s+(?<color>.+)$/u.exec(outline);
  assert.ok(outlineParts, `${selector} must have a solid outline`);
  assert.ok(Number(outlineParts.groups.width) > 0, `${selector} outline must have width`);
  const foreground = parseColor(outlineParts.groups.color);
  const weakest = weakestContrast(foreground, relevantBackgrounds);
  assert.ok(weakest.ratio >= 3, `${selector} focus contrast is below 3:1 (${weakest.ratio})`);
  return { selector, foreground, sampledMinimumContrast: weakest.ratio };
});

assert.deepEqual(parseColor(declaration(".button-primary", "background")), parseColor("#d9503f"), "primary button fill changed");

console.log(
  JSON.stringify({
    receipt: "HOTEL_CONTRAST_VALIDATION_PASS",
    scope: {
      method: "discrete-sampling",
      bodyGradientGrid: { baseSteps: 101, radialAlphaSteps: 101 },
      panelSamples: panelBackgrounds.length,
      sampledOnly: true,
      fullScreenAccessibilityProof: false,
    },
    thresholds: { smallText: 4.5, focusIndicator: 3 },
    bodySamples: bodyBackgrounds.length,
    panelSamples: panelBackgrounds.length,
    sampledBackgroundRgbRange: sampledBackgroundRange,
    smallText: smallTextResults,
    focus: focusResults,
  }),
);
