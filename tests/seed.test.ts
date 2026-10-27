import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, createInitialState } from "@/lib/kabaddi";

const seed = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");

function jsonBetween(tag: string): unknown {
  const match = seed.match(new RegExp(`\\$${tag}\\$(.*?)\\$${tag}\\$`, "s"));
  if (!match) throw new Error(`No $${tag}$ block in seed.sql`);
  return JSON.parse(match[1]);
}

describe("supabase/seed.sql", () => {
  it("settings match the engine defaults", () => {
    expect(jsonBetween("settings")).toEqual(DEFAULT_SETTINGS);
  });

  it("state matches createInitialState", () => {
    expect(jsonBetween("state")).toEqual(createInitialState("Tigers", "Lions"));
  });
});
