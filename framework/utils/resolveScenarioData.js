// import { dataStore } from "./dataStore.js";

// /**
//  * Placeholder format (full string only):
//  *   "{<scenario_id>.<key>}"
//  * Example:
//  *   "{1215b05c-6cfe-4bb5-92b2-2338583cd851.jobId}"
//  */

// export function resolveScenarioData(userId, testCaseId, scenarioData) {
//   if (!scenarioData || typeof scenarioData !== "object") return scenarioData;

//   const resolved = {};

//   // allow UUID (hyphens), underscore, numbers, letters for scenarioId
//   // allow same for key
//   // spaces allowed inside {}
//   const PLACEHOLDER_RE = /^\{\s*([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)\s*\}$/;

//   for (const [stepId, value] of Object.entries(scenarioData)) {
//     // only string values can be placeholders
//     if (typeof value !== "string") {
//       resolved[stepId] = value;
//       continue;
//     }

//     const match = value.match(PLACEHOLDER_RE);

//     // normal string → copy as is
//     if (!match) {
//       resolved[stepId] = value;
//       continue;
//     }

//     const scenarioId = match[1];
//     const key = match[2];

//     const actual = dataStore.resolvePlaceholder(userId, testCaseId, scenarioId, key);
//     resolved[stepId] = actual;
//   }

//   return resolved;
// }


import { dataStore } from "./dataStore.js";

/**
 * Placeholder format (full string only):
 *   "{<scenario_id>.<key>}"
 * Example:
 *   "{1215b05c-6cfe-4bb5-92b2-2338583cd851.jobId}"
 */

export function resolveScenarioData(userId, testCaseId, data) {
  if(!data) return data;

  const PLACEHOLDER_RE = /^\{\s*([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)\s*\}$/;
  if (typeof data !== "string") {
    return data;
  }
  const match = data.match(PLACEHOLDER_RE);
  if (!match) {
    return data;
  }
  const scenarioId = match[1];
  const key = match[2];
  const actual = dataStore.resolvePlaceholder(userId, testCaseId, scenarioId, key);

  return actual;
}
