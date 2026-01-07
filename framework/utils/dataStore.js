export class DataStore {
  constructor() {
    // userId -> testcaseId -> scenarioId -> { key: value }
    this.userOutputs = {};
  }

  // Ensure container exists for user -> testcase -> scenario
  ensureContainer(userId, testCaseId, scenarioId) {
    if (!userId) throw new Error("userId is required for DataStore operations");

    if (!this.userOutputs[userId]) {
      this.userOutputs[userId] = {};
    }
    if (!this.userOutputs[userId][testCaseId]) {
      this.userOutputs[userId][testCaseId] = {};
    }
    if (!this.userOutputs[userId][testCaseId][scenarioId]) {
      this.userOutputs[userId][testCaseId][scenarioId] = {};
    }
  }

  // Save output under user -> testcase -> scenario -> key
  setScenarioOutput(userId, testCaseId, scenarioId, key, value) {
    this.ensureContainer(userId, testCaseId, scenarioId);
    this.userOutputs[userId][testCaseId][scenarioId][key] = value;
  }

  // Get output for user -> testcase -> scenario -> key
  getScenarioOutput(userId, testCaseId, scenarioId, key) {
    return this.userOutputs?.[userId]?.[testCaseId]?.[scenarioId]?.[key];
  }

  // Get all outputs of a scenario for a user
  getScenarioAll(userId, testCaseId, scenarioId) {
    return this.userOutputs?.[userId]?.[testCaseId]?.[scenarioId] || {};
  }

  // get all outputs of a testcase for a user
  getTestcaseAll(userId, testCaseId) {
    return this.userOutputs?.[userId]?.[testCaseId] || {};
  }

  // Placeholder resolver: {SCN-JOB-1.jobId}
  resolvePlaceholder(userId, testCaseId, scenarioId, field) {
    const value = this.getScenarioOutput(userId, testCaseId, scenarioId, field);

    if (value === undefined) {
      throw new Error(
        `Cannot resolve placeholder: '${scenarioId}.${field}' in testcase '${testCaseId}' for user '${userId}'`
      );
    }

    return value;
  }

  // Reset ONLY one user's data (safe for multi-user)
  resetUser(userId) {
    if (!userId) throw new Error("userId is required to reset user data");
    this.userOutputs[userId] = {};
  }

  // Optional: clear everything (admin/debug only)
  resetAll() {
    this.userOutputs = {};
  }
}

export const dataStore = new DataStore();
