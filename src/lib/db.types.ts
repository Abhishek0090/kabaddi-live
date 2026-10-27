import type { MatchState, Settings } from "./kabaddi.types";

// Hand-written to match supabase/schema.sql. Keep the two in step.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MatchStatus = "scheduled" | "live" | "finished";

type MatchRowFull = {
  id: string;
  team_a: string;
  team_b: string;
  scheduled_at: string | null;
  settings: Settings;
  state: MatchState;
  scorer_id: string;
  status: MatchStatus;
  last_seq: number;
  created_at: string;
  updated_at: string;
};

type MatchEventRowFull = {
  id: number;
  match_id: string;
  seq: number;
  type: string;
  payload: Json;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      matches: {
        Row: MatchRowFull;
        Insert: Omit<MatchRowFull, "id" | "scorer_id" | "status" | "last_seq" | "created_at" | "updated_at"> &
          Partial<Pick<MatchRowFull, "id" | "scorer_id" | "status">>;
        Update: Partial<MatchRowFull>;
        Relationships: [];
      };
      match_events: {
        Row: MatchEventRowFull;
        Insert: Omit<MatchEventRowFull, "id" | "created_at">;
        Update: Partial<MatchEventRowFull>;
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      record_event: {
        Args: { p_match: string; p_seq: number; p_type: string; p_payload: Json; p_state: MatchState };
        Returns: string;
      };
      undo_last_event: {
        Args: { p_match: string; p_seq: number; p_state: MatchState };
        Returns: string;
      };
      server_now: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

/** Columns the public pages read. */
export const PUBLIC_MATCH_COLUMNS =
  "id, team_a, team_b, scheduled_at, status, state, updated_at" as const;

export type MatchRow = Pick<
  MatchRowFull,
  "id" | "team_a" | "team_b" | "scheduled_at" | "status" | "state" | "updated_at"
>;

export type ScorerMatchRow = MatchRow & Pick<MatchRowFull, "settings" | "scorer_id" | "last_seq">;
