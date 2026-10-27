"use client";

import { useEffect, useState } from "react";
import { PUBLIC_MATCH_COLUMNS, type MatchRow } from "./db.types";
import { MOCK } from "./mode";
import { createClient } from "./supabase/client";

export type LiveStatus = "connecting" | "live" | "reconnecting";

const MOCK_POLL_MS = 1000;

/** Keeps the newer of two copies of a row, so a late refetch can't undo a realtime update. */
function newer(prev: MatchRow, next: MatchRow): MatchRow {
  return Date.parse(next.updated_at) >= Date.parse(prev.updated_at) ? next : prev;
}

function pick(row: MatchRow): MatchRow {
  const { id, team_a, team_b, scheduled_at, status, state, updated_at } = row;
  return { id, team_a, team_b, scheduled_at, status, state, updated_at };
}

/**
 * Live copy of one match. Subscribes to UPDATEs on its row and refetches
 * whenever updates may have been missed: after (re)subscribing, on focus,
 * and when the network comes back. Realtime does not replay missed changes.
 * In mock mode it polls the mock API every second instead.
 */
export function useLiveMatch(initial: MatchRow): { match: MatchRow; status: LiveStatus } {
  const [match, setMatch] = useState(initial);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const id = initial.id;

  useEffect(() => {
    let active = true;
    const cleanups: (() => void)[] = [];
    let refetch: () => Promise<void>;

    if (MOCK) {
      refetch = async () => {
        try {
          const res = await fetch(`/api/mock/matches/${id}`, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          const data = (await res.json()) as MatchRow;
          if (!active) return;
          setMatch((prev) => newer(prev, data));
          setStatus("live");
        } catch {
          if (active) setStatus("reconnecting");
        }
      };
      const timer = setInterval(() => void refetch(), MOCK_POLL_MS);
      void refetch();
      cleanups.push(() => clearInterval(timer));
    } else {
      const supabase = createClient();
      refetch = async () => {
        const { data } = await supabase.from("matches").select(PUBLIC_MATCH_COLUMNS).eq("id", id).maybeSingle();
        if (active && data) setMatch((prev) => newer(prev, data));
      };
      const channel = supabase
        .channel(`match:${id}`)
        .on<MatchRow>(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${id}` },
          (payload) => setMatch((prev) => newer(prev, pick(payload.new as MatchRow))),
        )
        .subscribe((s) => {
          if (!active) return;
          if (s === "SUBSCRIBED") {
            setStatus("live");
            void refetch();
          } else {
            setStatus("reconnecting");
          }
        });
      cleanups.push(() => void supabase.removeChannel(channel));
    }

    const onFocus = () => void refetch();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    const onOffline = () => setStatus("reconnecting");
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      for (const cleanup of cleanups) cleanup();
    };
  }, [id]);

  return { match, status };
}
