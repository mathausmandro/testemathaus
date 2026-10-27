// Tipos de domínio expostos pela camada de dados (derivados dos tipos do banco).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./database.types";

export type DbClient = SupabaseClient<Database>;
export type AppRole = Database["public"]["Enums"]["app_role"];
export type TrialDesign = Database["public"]["Enums"]["trial_design"];
export type Profile = Tables<"profiles">;
export type Trial = Tables<"trials">;
