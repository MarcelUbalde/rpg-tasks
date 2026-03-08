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

// Maps Vibia priority names to the canonical severity values expected by goldForSeverity.
// Fallback to raw value so English names (High, Critical…) pass through unchanged.
const PRIORITY_MAP = {
  "Crítica": "Critical",
  "Alta":    "High",
  "Media":   "Medium",
  "Baja":    "Low",
};
function normalizePriority(name) { return PRIORITY_MAP[name] ?? name; }

// Validates and returns SP as a positive finite number (decimals allowed). CC=4.
function extractStoryPoints(fields, spField) {
  const sp = fields?.[spField];
  if (sp == null) throwCode("missing_sp", `Story Points field "${spField}" is null/undefined — issue may not be estimated`);
  if (!Number.isFinite(sp)) throwCode("invalid_sp", `Story Points field "${spField}" is not a finite number (got ${sp})`);
  if (sp <= 0) throwCode("sp_not_estimated", `Story Points must be > 0 to award EXP (got ${sp})`);
  return sp;
}

// Validates severity and returns it; uses priority fallback when severityField is not configured. CC=3.
function extractSeverity(fields, severityField) {
  const raw = severityField
    ? fields?.[severityField]
    : normalizePriority(fields?.priority?.name);
  try {
    goldForSeverity(raw);
  } catch {
    throwCode("invalid_severity", `Severity value "${raw}" is not mappable (expected: Low, Medium, High, Critical)`);
  }
  return raw;
}

// Main parser. CC=7.
export function parseJiraDoneEvent(body, { doneName, spField, severityField, bugIssueTypes, taskIssueTypes }) {
  const changelogId = body?.changelog?.id;
  if (!changelogId) throwCode("missing_changelog_id", "changelog.id is required for idempotency — webhook rejected");

  const items = body?.changelog?.items ?? [];
  const isDone = items.some((i) => i.field === "status" && i.toString === doneName);
  if (!isDone) return null;

  const issueKey = body?.issue?.key;
  if (!issueKey) throwCode("missing_issue_key", "issue.key is required");

  const fields = body?.issue?.fields ?? {};
  const issueTypeName = fields?.issuetype?.name;
  const isBug  = bugIssueTypes.has(issueTypeName);
  const isTask = taskIssueTypes.has(issueTypeName);
  if (!isBug && !isTask)
    throwCode("unsupported_issuetype", `Issuetype "${issueTypeName}" is not in bugIssueTypes or taskIssueTypes — skipped`);

  const externalKey = `${issueKey}-done-${changelogId}`;
  const summary = body?.issue?.fields?.summary ?? null;

  if (isBug) {
    const severity = extractSeverity(fields, severityField);
    return { type: "BUG", externalKey, payload: { severity }, issueKey, summary };
  }

  const storyPoints = extractStoryPoints(fields, spField);
  return { type: "TASK", externalKey, payload: { storyPoints }, issueKey, summary };
}
