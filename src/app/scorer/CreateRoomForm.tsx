"use client";

import { useActionState, useState } from "react";
import { btn, card, input, label } from "@/components/ui";
import { SETTING_FIELDS, defaultFieldValue } from "@/lib/settings";
import { createRoom } from "./actions";

export function CreateRoomForm() {
  const [state, formAction, pending] = useActionState(createRoom, {});
  const [localTime, setLocalTime] = useState("");
  const iso = localTime ? new Date(localTime).toISOString() : "";

  return (
    <form action={formAction} className={`${card} flex flex-col gap-4`}>
      <h2 className="text-xl font-black">Create a match room</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Team A
          <input className={input} name="teamA" maxLength={60} required />
        </label>
        <label className={label}>
          Team B
          <input className={input} name="teamB" maxLength={60} required />
        </label>
      </div>
      <label className={label}>
        Date and time
        <input
          className={input}
          type="datetime-local"
          value={localTime}
          onChange={(e) => setLocalTime(e.target.value)}
          required
        />
        <input type="hidden" name="scheduledAt" value={iso} />
      </label>

      <details className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm font-semibold">Match settings (optional)</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SETTING_FIELDS.map((f) => (
            <label key={f.name} className={label}>
              {f.label}
              {f.unit && ` (${f.unit})`}
              <input
                className={input}
                name={f.name}
                type="number"
                inputMode="numeric"
                min={f.min}
                max={f.max}
                step={1}
                placeholder={String(defaultFieldValue(f.name))}
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Empty fields use the default shown.</p>
      </details>

      <p role="alert" aria-live="polite" className="min-h-6 text-sm font-semibold text-red-600 dark:text-red-400">
        {state.error}
      </p>
      <button className={btn.primary} disabled={pending}>
        {pending ? "Creating..." : "Create room"}
      </button>
    </form>
  );
}
