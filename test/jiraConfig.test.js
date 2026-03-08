// test/jiraConfig.test.js
// Unit tests for validateJiraConfig() pure function.
// No database, HTTP server, or ENV vars required.

import { describe, it, expect } from "vitest";
import { validateJiraConfig } from "../server/config/jira.js";

const fullConfig = {
  secret:          "my-secret",
  spField:         "customfield_10009",
  developersField: "customfield_10819",
  doneName:        "Done",
  severityField:   "",
  qaField:         "",
  userMap:         {},
};

describe("validateJiraConfig", () => {
  it("config completa → errors y warnings vacíos", () => {
    const { errors, warnings } = validateJiraConfig(fullConfig);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("secret vacío → error en errors[]", () => {
    const { errors } = validateJiraConfig({ ...fullConfig, secret: "" });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/JIRA_WEBHOOK_SECRET/);
  });

  it("spField vacío → warning en warnings[]", () => {
    const { warnings, errors } = validateJiraConfig({ ...fullConfig, spField: "" });
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/JIRA_SP_FIELD/);
  });

  it("developersField vacío → warning en warnings[]", () => {
    const { warnings, errors } = validateJiraConfig({ ...fullConfig, developersField: "" });
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/JIRA_DEVELOPERS_FIELD/);
  });

  it("solo secret configurado → warnings pero sin errors", () => {
    const { errors, warnings } = validateJiraConfig({
      ...fullConfig,
      spField: "",
      developersField: "",
    });
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(2);
  });

  it("siempre devuelve { errors: [], warnings: [] } aunque no haya problemas", () => {
    const result = validateJiraConfig(fullConfig);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
