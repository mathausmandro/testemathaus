// Tipos de domínio expostos pela camada de dados (derivados dos tipos do banco).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, Tables } from "./database.types";

export type { Json };
export type DbClient = SupabaseClient<Database>;
export type AppRole = Database["public"]["Enums"]["app_role"];
export type TrialDesign = Database["public"]["Enums"]["trial_design"];
export type Profile = Tables<"profiles">;
export type Trial = Tables<"trials">;
export type TrialMember = Tables<"trial_members">;
