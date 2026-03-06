// server/application/jira/parseJiraDoneEvent.js
// Pure function — parses a raw Jira webhook body into a reward event descriptor.
// Returns null if the webhook is not a "Done" transition (caller responds 200 skipped).
// Throws Error with .code for invalid or missing required fields (caller responds 400).

import { goldForSeverity } from "../../domain/BugReward.js";

function throwCode(code, message) {
  const e = new Error(message);
  e.code = code;
  throw e;
}

// Validates and returns SP as a positive finite number (decimals allowed). CC=4.
function extractStoryPoints(fields, spField) {
  const sp = fields?.[spField];
  if (sp == null) throwCode("missing_sp", `Story Points field "${spField}" is null/undefined — issue may not be estimated`);
  if (!Number.isFinite(sp)) throwCode("invalid_sp", `Story Points field "${spField}" is not a finite number (got ${sp})`);
  if (sp <= 0) throwCode("sp_not_estimated", `Story Points must be > 0 to award EXP (got ${sp})`);
  return sp;
}

// Validates severity and returns it; throws if field unconfigured or value unmappable. CC=3.
function extractSeverity(fields, severityField) {
  if (!severityField) throwCode("severity_field_not_configured", "JIRA_SEVERITY_FIELD is not configured");
  const severity = fields?.[severityField];
  try {
    goldForSeverity(severity);
  } catch {
    throwCode("invalid_severity", `Severity value "${severity}" is not mappable (expected: Low, Medium, High, Critical)`);
  }
  return severity;
}

// Main parser. CC=6.
export function parseJiraDoneEvent(body, { doneName, spField, severityField }) {
  const changelogId = body?.changelog?.id;
  if (!changelogId) throwCode("missing_changelog_id", "changelog.id is required for idempotency — webhook rejected");

  const items = body?.changelog?.items ?? [];
  const isDone = items.some((i) => i.field === "status" && i.toString === doneName);
  if (!isDone) return null;

  const issueKey = body?.issue?.key;
  if (!issueKey) throwCode("missing_issue_key", "issue.key is required");

  const fields = body?.issue?.fields ?? {};
  const isBug = fields?.issuetype?.name === "Bug";
  const externalKey = `${issueKey}-done-${changelogId}`;

  const summary = body?.issue?.fields?.summary ?? null;

  if (isBug) {
    const severity = extractSeverity(fields, severityField);
    return { type: "BUG", externalKey, payload: { severity }, issueKey, summary };
  }

  const storyPoints = extractStoryPoints(fields, spField);
  return { type: "TASK", externalKey, payload: { storyPoints }, issueKey, summary };
}
