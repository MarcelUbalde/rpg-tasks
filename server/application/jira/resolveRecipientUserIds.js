// server/application/jira/resolveRecipientUserIds.js
// Pure function — maps Jira accountIds to RPG userIds using the configured userMap.
// Priority: Developers custom field > assignee > empty.

// Extracts raw Jira accountIds from the webhook body. CC=3.
function extractJiraAccountIds(body, developersField) {
  if (developersField) {
    const devs = body?.issue?.fields?.[developersField];
    if (Array.isArray(devs) && devs.length > 0) {
      return devs.map((u) => u?.accountId).filter(Boolean);
    }
  }
  const assigneeId = body?.issue?.fields?.assignee?.accountId;
  return assigneeId ? [assigneeId] : [];
}

// Maps Jira accountIds to RPG userIds, collecting unmapped ones. CC=1.
export function resolveRecipientUserIds(body, userMap, developersField) {
  const jiraUsers = extractJiraAccountIds(body, developersField);
  const userIds = [];
  const unmappedRecipients = [];
  for (const accountId of jiraUsers) {
    (userMap[accountId] ? userIds : unmappedRecipients).push(userMap[accountId] ?? accountId);
  }
  return { userIds, unmappedRecipients };
}
