// server/config/jira.js
// Centralizes Jira webhook configuration from ENV vars.
// All functions are pure and importable without side effects.

function parseUserMap(json) {
  if (!json) return {};
  try { return JSON.parse(json); } catch {
    console.warn("[jira config] USER_MAP_JSON is not valid JSON — no Jira users will be mapped");
    return {};
  }
}

// Pure validation function — testable without DB or ENV.
export function isValidWebhookSecret(headerValue, configuredSecret) {
  return Boolean(configuredSecret) && headerValue === configuredSecret;
}

// Pure function — exported for unit tests and startup validation.
export function validateJiraConfig(config) {
  const errors = [];
  const warnings = [];
  if (!config.secret)
    errors.push("JIRA_WEBHOOK_SECRET is not set — all webhook requests will be rejected (401)");
  if (!config.spField)
    warnings.push("JIRA_SP_FIELD is empty — TASK rewards will fail at runtime");
  if (!config.developersField)
    warnings.push("JIRA_DEVELOPERS_FIELD is empty — developers will not be resolved from the configured Jira field");
  return { errors, warnings };
}

export const jiraConfig = {
  secret:          process.env.JIRA_WEBHOOK_SECRET ?? "",
  doneName:        process.env.JIRA_DONE_STATUS_NAME ?? "Done",
  spField:         process.env.JIRA_SP_FIELD ?? "customfield_10009",
  severityField:   process.env.JIRA_SEVERITY_FIELD ?? "",
  developersField: process.env.JIRA_DEVELOPERS_FIELD ?? "customfield_10819",
  qaField:         process.env.JIRA_QA_FIELD ?? "",
  userMap:         parseUserMap(process.env.USER_MAP_JSON),
};
