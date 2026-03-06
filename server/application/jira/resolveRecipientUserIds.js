// server/application/jira/resolveRecipientUserIds.js
// Pure function — maps Jira accountIds to RPG userIds using the configured userMap.
// Sources: Developers custom field (array) + QA custom field (object). No assignee fallback.

// Extracts raw Jira accountIds from developers and QA fields. CC=6.
function extractJiraAccountIds(body, developersField, qaField) {
  const fields = body?.issue?.fields ?? {};
  const accountIds = [];

  if (developersField) {
    const devs = fields[developersField];
    if (Array.isArray(devs) && devs.length > 0) {
      accountIds.push(...devs.map((u) => u?.accountId).filter(Boolean));
    }
  }

  if (qaField) {
    const qaId = fields[qaField]?.accountId;
    if (qaId) accountIds.push(qaId);
  }

  return accountIds;
}

// Maps Jira accountIds to RPG userIds, deduplicating and collecting unmapped ones. CC=4.
export function resolveRecipientUserIds(body, userMap, developersField, qaField) {
  const raw = extractJiraAccountIds(body, developersField, qaField);
  const seen = new Set();
  const unique = raw.filter((id) => (seen.has(id) ? false : seen.add(id)));
  const userIds = [];
  const unmappedRecipients = [];
  for (const accountId of unique) {
    (userMap[accountId] ? userIds : unmappedRecipients).push(userMap[accountId] ?? accountId);
  }
  return { userIds, unmappedRecipients };
}
