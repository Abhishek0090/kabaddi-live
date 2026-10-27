import { DEFAULT_SETTINGS } from "./kabaddi";
import type { Settings } from "./kabaddi.types";

/** Form fields for the settings override, in the units the form shows. */
export const SETTING_FIELDS = [
  { name: "playersOnMat", label: "Players on mat", unit: "", min: 5, max: 7, toSettings: 1 },
  { name: "halfMinutes", label: "Half length", unit: "min", min: 1, max: 60, toSettings: 60_000 },
  { name: "raidSeconds", label: "Raid clock", unit: "sec", min: 10, max: 60, toSettings: 1000 },
  { name: "timeoutsPerHalf", label: "Timeouts per half", unit: "", min: 0, max: 5, toSettings: 1 },
  { name: "timeoutSeconds", label: "Timeout length", unit: "sec", min: 10, max: 300, toSettings: 1000 },
  { name: "allOutBonus", label: "All out bonus", unit: "pts", min: 0, max: 5, toSettings: 1 },
] as const;

type FieldName = (typeof SETTING_FIELDS)[number]["name"];

const SETTINGS_KEY: Record<FieldName, keyof Settings> = {
  playersOnMat: "playersOnMat",
  halfMinutes: "halfMs",
  raidSeconds: "raidMs",
  timeoutsPerHalf: "timeoutsPerHalf",
  timeoutSeconds: "timeoutMs",
  allOutBonus: "allOutBonus",
};

export function defaultFieldValue(name: FieldName): number {
  const field = SETTING_FIELDS.find((f) => f.name === name)!;
  return DEFAULT_SETTINGS[SETTINGS_KEY[name]] / field.toSettings;
}

/** Empty fields keep the default. Returns the settings or the first problem. */
export function parseSettings(
  values: Partial<Record<FieldName, string | null | undefined>>,
): { ok: true; settings: Settings } | { ok: false; error: string } {
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const field of SETTING_FIELDS) {
    const raw = values[field.name]?.trim();
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < field.min || n > field.max) {
      return { ok: false, error: `${field.label} must be a whole number from ${field.min} to ${field.max}.` };
    }
    settings[SETTINGS_KEY[field.name]] = n * field.toSettings;
  }
  return { ok: true, settings };
}

export function parseTeamName(raw: unknown, label: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: false, error: `${label} name is required.` };
  if (name.length > 60) return { ok: false, error: `${label} name is too long (60 characters max).` };
  return { ok: true, name };
}
