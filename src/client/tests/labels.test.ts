import { describe, expect, it } from "vitest";
import { parseLabels } from "../labels";

describe("parseLabels", () => {
  it("keeps values containing equals signs and trims surrounding whitespace", () => {
    expect(parseLabels(" team = platform\n url=https://example.test?a=1 ")).toEqual({
      team: "platform",
      url: "https://example.test?a=1",
    });
  });

  it("rejects a label without a key-value separator", () => {
    expect(() => parseLabels("not-a-pair")).toThrow("Expected KEY=VALUE: not-a-pair");
  });

  it("treats empty lines as no labels", () => {
    expect(parseLabels(" \n ")).toEqual({});
  });
});
