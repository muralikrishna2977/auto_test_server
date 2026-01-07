import { dataStore } from "./dataStore.js";

/**
 * scenarioData example:
 * {
 *   sc1_30: "{sc1.checkOrUncheck}",
 *   sc1_31: "kotlin, java",
 * }
 *
 * Placeholder format:
 *   "{sc1.checkOrUncheck}"
 *
 * Means:
 *   scenarioId = "sc1"
 *   key       = "checkOrUncheck"
 */
export function resolveScenarioData(userId, testCaseId, scenarioData) {
  if (!scenarioData || typeof scenarioData !== "object") return scenarioData;

  const resolved = {};

  // Full-string placeholder only: "{sc1.checkOrUncheck}"
  // group1=scenarioId, group2=key
  const PLACEHOLDER_RE = /^\{\s*([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)\s*\}$/;

  for (const [fieldId, value] of Object.entries(scenarioData)) {
    // only string values can be placeholders
    if (typeof value !== "string") {
      resolved[fieldId] = value;
      continue;
    }

    const match = value.match(PLACEHOLDER_RE);

    // normal string → copy as is
    if (!match) {
      resolved[fieldId] = value;
      continue;
    }

    const scenarioId = match[1]; // sc1
    const key = match[2];        // checkOrUncheck

    // will throw a clear error if missing (good!)
    const actual = dataStore.resolvePlaceholder(
      userId,
      testCaseId,
      scenarioId,
      key
    );

    resolved[fieldId] = actual;
  }

  return resolved;
}
