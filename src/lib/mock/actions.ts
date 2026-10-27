"use server";

import type { MatchEvent, MatchState } from "../kabaddi.types";
import { MOCK } from "../mode";
import { mockSessionUser } from "./session";
import { mockRecordEvent, mockUndoLastEvent, type MockWriteResult } from "./store";

// Mock-mode stand-ins for the record_event and undo_last_event RPCs.

async function scorerId(): Promise<string | null> {
  if (!MOCK) return null;
  return (await mockSessionUser())?.id ?? null;
}

export async function mockRecordEventAction(
  matchId: string,
  seq: number,
  event: MatchEvent,
  state: MatchState,
): Promise<MockWriteResult> {
  const userId = await scorerId();
  if (!userId) return { code: "KB404", message: "Log in again to keep scoring." };
  return mockRecordEvent(matchId, userId, seq, event, state);
}

export async function mockUndoAction(matchId: string, seq: number, state: MatchState): Promise<MockWriteResult> {
  const userId = await scorerId();
  if (!userId) return { code: "KB404", message: "Log in again to keep scoring." };
  return mockUndoLastEvent(matchId, userId, seq, state);
}
