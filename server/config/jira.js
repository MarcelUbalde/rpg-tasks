// server/config/jira.js
// Centralizes Jira webhook configuration from ENV vars.
// All functions are pure and importable without side effects.

function parseUserMap(json) {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

// Pure validation function — testable without DB or ENV.
export function isValidWebhookSecret(headerValue, configuredSecret) {
  return Boolean(configuredSecret) && headerValue === configuredSecret;
}

export const jiraConfig = {
  secret:          process.env.JIRA_WEBHOOK_SECRET ?? "",
  doneName:        process.env.JIRA_DONE_STATUS_NAME ?? "Done",
  spField:         process.env.JIRA_SP_FIELD ?? "customfield_10009",
  severityField:   process.env.JIRA_SEVERITY_FIELD ?? "",
  developersField: process.env.JIRA_DEVELOPERS_FIELD ?? "customfield_10819",
  userMap:         parseUserMap(process.env.USER_MAP_JSON),
};
