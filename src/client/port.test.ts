import { describe, expect, it } from "vitest";
import { parsePort } from "./port";

describe("parsePort", () => {
  it.each(["", "   "])("requires an explicit choice for %j", (value) => {
    expect(parsePort(value)).toEqual({
      ok: false,
      message: "Choose an internal container port before deploying.",
    });
  });

  it.each(["0", "65536", "-1", "80.5", "abc", "1e3", "99999999999999999999"])(
    "rejects invalid port %j",
    (value) => {
      expect(parsePort(value)).toEqual({
        ok: false,
        message: "Enter a whole-number port between 1 and 65535.",
      });
    },
  );

  it.each([
    ["80", 80],
    ["3000", 3000],
    [" 8080 ", 8080],
    ["65535", 65535],
  ])("accepts %j as internal port %i", (value, port) => {
    expect(parsePort(value)).toEqual({ ok: true, port });
  });
});
