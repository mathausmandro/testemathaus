// Tipos do banco no formato de `supabase gen types typescript --local`.
// ESCRITO À MÃO a partir de supabase/migrations (orientação de 27/10/2026, sem Docker).
// Não executado: requer Docker/Supabase local. O parceiro deve regenerar com
// `npx supabase gen types typescript --local > src/lib/data/database.types.ts` e comparar.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          applied_at: string
          change_reason: string | null
          client_id: string
          created_at: string
          created_by: string
          equipment: string | null
          id: string
          notes: string | null
          operator_name: string | null
          relative_humidity_pct: number | null
          spray_volume: number | null
          spray_volume_unit: string | null
          status: string
          temperature_c: number | null
          trial_id: string
          updated_at: string
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
          wind_speed_kmh: number | null
        }
        Insert: {
          applied_at: string
          change_reason?: string | null
          client_id: string
          created_at?: string
          created_by?: string
          equipment?: string | null
          id?: string
          notes?: string | null
          operator_name?: string | null
          relative_humidity_pct?: number | null
          spray_volume?: number | null
          spray_volume_unit?: string | null
          status?: string
          temperature_c?: number | null
          trial_id: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
          wind_speed_kmh?: number | null
        }
        Update: {
          applied_at?: string
          change_reason?: string | null
          client_id?: string
          created_at?: string
          created_by?: string
          equipment?: string | null
          id?: string
          notes?: string | null
          operator_name?: string | null
          relative_humidity_pct?: number | null
          spray_volume?: number | null
          spray_volume_unit?: string | null
          status?: string
          temperature_c?: number | null
          trial_id?: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
          wind_speed_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_variables: {
        Row: {
          created_at: string
          id: string
          max_value: number | null
          method: string | null
          min_value: number | null
          name: string
          scale: string | null
          trial_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_value?: number | null
          method?: string | null
          min_value?: number | null
          name: string
          scale?: string | null
          trial_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_value?: number | null
          method?: string | null
          min_value?: number | null
          name?: string
          scale?: string | null
          trial_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_variables_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
        ]
      }
      change_history: {
        Row: {
          actor_role: string | null
          author_id: string | null
          changed_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          operation: string
          reason: string | null
          record_id: string
          table_name: string
          trial_id: string | null
        }
        Insert: {
          actor_role?: string | null
          author_id?: string | null
          changed_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          operation: string
          reason?: string | null
          record_id: string
          table_name: string
          trial_id?: string | null
        }
        Update: {
          actor_role?: string | null
          author_id?: string | null
          changed_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          operation?: string
          reason?: string | null
          record_id?: string
          table_name?: string
          trial_id?: string | null
        }
        Relationships: []
      }
      factor_levels: {
        Row: {
          created_at: string
          factor_id: string
          id: string
          name: string
          position: number | null
          trial_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          factor_id: string
          id?: string
          name: string
          position?: number | null
          trial_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          factor_id?: string
          id?: string
          name?: string
          position?: number | null
          trial_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factor_levels_factor_fkey"
            columns: ["factor_id", "trial_id"]
            isOneToOne: false
            referencedRelation: "factors"
            referencedColumns: ["id", "trial_id"]
          },
          {
            foreignKeyName: "factor_levels_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
        ]
      }
      factors: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number | null
          trial_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number | null
          trial_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number | null
          trial_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factors_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
        ]
      }
      field_record_photos: {
        Row: {
          change_reason: string | null
          client_id: string
          created_at: string
          created_by: string
          field_record_id: string
          id: string
          latitude: number | null
          location_accuracy_m: number | null
          longitude: number | null
          status: string
          storage_path: string
          taken_at: string | null
          trial_id: string
          updated_at: string
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        Insert: {
          change_reason?: string | null
          client_id: string
          created_at?: string
          created_by?: string
          field_record_id: string
          id?: string
          latitude?: number | null
          location_accuracy_m?: number | null
          longitude?: number | null
          status?: string
          storage_path: string
          taken_at?: string | null
          trial_id: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Update: {
          change_reason?: string | null
          client_id?: string
          created_at?: string
          created_by?: string
          field_record_id?: string
          id?: string
          latitude?: number | null
          location_accuracy_m?: number | null
          longitude?: number | null
          status?: string
          storage_path?: string
          taken_at?: string | null
          trial_id?: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_record_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_record_photos_record_fkey"
            columns: ["field_record_id", "trial_id"]
            isOneToOne: false
            referencedRelation: "field_records"
            referencedColumns: ["id", "trial_id"]
          },
          {
            foreignKeyName: "field_record_photos_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_record_photos_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      field_records: {
        Row: {
          change_reason: string | null
          client_id: string
          created_at: string
          created_by: string
          id: string
          latitude: number | null
          location_accuracy_m: number | null
          longitude: number | null
          notes: string | null
          planned_assessment_id: string
          plot_id: string
          recorded_at: string
          status: string
          trial_id: string
          updated_at: string
          value_numeric: number | null
          value_text: string | null
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        Insert: {
          change_reason?: string | null
          client_id: string
          created_at?: string
          created_by?: string
          id?: string
          latitude?: number | null
          location_accuracy_m?: number | null
          longitude?: number | null
          notes?: string | null
          planned_assessment_id: string
          plot_id: string
          recorded_at?: string
          status?: string
          trial_id: string
          updated_at?: string
          value_numeric?: number | null
          value_text?: string | null
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Update: {
          change_reason?: string | null
          client_id?: string
          created_at?: string
          created_by?: string
          id?: string
          latitude?: number | null
          location_accuracy_m?: number | null
          longitude?: number | null
          notes?: string | null
          planned_assessment_id?: string
          plot_id?: string
          recorded_at?: string
          status?: string
          trial_id?: string
          updated_at?: string
          value_numeric?: number | null
          value_text?: string | null
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_records_planned_assessment_fkey"
            columns: ["planned_assessment_id", "trial_id"]
            isOneToOne: false
            referencedRelation: "planned_assessments"
            referencedColumns: ["id", "trial_id"]
          },
          {
            foreignKeyName: "field_records_plot_fkey"
            columns: ["plot_id", "trial_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id", "trial_id"]
          },
          {
            foreignKeyName: "field_records_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_records_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrences: {
        Row: {
          change_reason: string | null
          client_id: string
          created_at: string
          created_by: string
          description: string
          id: string
          occurred_at: string
          plot_id: string | null
          status: string
          trial_id: string
          updated_at: string
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        Insert: {
          change_reason?: string | null
          client_id: string
          created_at?: string
          created_by?: string
          description: string
          id?: string
          occurred_at: string
          plot_id?: string | null
          status?: string
          trial_id: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Update: {
          change_reason?: string | null
          client_id?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          occurred_at?: string
          plot_id?: string | null
          status?: string
          trial_id?: string
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_plot_fkey"
            columns: ["plot_id", "trial_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id", "trial_id"]
          },
          {
            foreignKeyName: "occurrences_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_assessments: {
        Row: {
          created_at: string
          days_after: number | null
          id: string
          planned_date: string | null
          reference_event: string | null
          responsible_id: string | null
          trial_id: string
          updated_at: string
          variable_id: string
        }
        Insert: {
          created_at?: string
          days_after?: number | null
          id?: string
          planned_date?: string | null
          reference_event?: string | null
          responsible_id?: string | null
          trial_id: string
          updated_at?: string
          variable_id: string
        }
        Update: {
          created_at?: string
          days_after?: number | null
          id?: string
          planned_date?: string | null
          reference_event?: string | null
          responsible_id?: string | null
          trial_id?: string
          updated_at?: string
          variable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_assessments_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_assessments_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_assessments_variable_fkey"
            columns: ["variable_id", "trial_id"]
            isOneToOne: false
            referencedRelation: "assessment_variables"
            referencedColumns: ["id", "trial_id"]
          },
        ]
      }
      plots: {
        Row: {
          block: number | null
          created_at: string
          grid_column: number | null
          grid_row: number | null
          id: string
          main_plot_id: string | null
          number: number
          treatment_id: string | null
          trial_id: string
          updated_at: string
        }
        Insert: {
          block?: number | null
          created_at?: string
          grid_column?: number | null
          grid_row?: number | null
          id?: string
          main_plot_id?: string | null
          number: number
          treatment_id?: string | null
          trial_id: string
          updated_at?: string
        }
        Update: {
          block?: number | null
          created_at?: string
          grid_column?: number | null
          grid_row?: number | null
          id?: string
          main_plot_id?: string | null
          number?: number
          treatment_id?: string | null
          trial_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plots_main_plot_fkey"
            columns: ["main_plot_id", "trial_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id", "trial_id"]
          },
          {
            foreignKeyName: "plots_treatment_fkey"
            columns: ["treatment_id", "trial_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id", "trial_id"]
          },
          {
            foreignKeyName: "plots_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Relationships: []
      }
      quality_flags: {
        Row: {
          change_reason: string | null
          comment: string | null
          created_at: string
          created_by: string
          field_record_id: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          status: string
          trial_id: string
          updated_at: string
        }
        Insert: {
          change_reason?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string
          field_record_id?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          status?: string
          trial_id: string
          updated_at?: string
        }
        Update: {
          change_reason?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string
          field_record_id?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          status?: string
          trial_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_flags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_flags_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_flags_record_fkey"
            columns: ["field_record_id", "trial_id"]
            isOneToOne: false
            referencedRelation: "field_records"
            referencedColumns: ["id", "trial_id"]
          },
          {
            foreignKeyName: "quality_flags_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_factor_levels: {
        Row: {
          created_at: string
          factor_level_id: string
          id: string
          treatment_id: string
          trial_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          factor_level_id: string
          id?: string
          treatment_id: string
          trial_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          factor_level_id?: string
          id?: string
          treatment_id?: string
          trial_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_factor_levels_level_fkey"
            columns: ["factor_level_id", "trial_id"]
            isOneToOne: false
            referencedRelation: "factor_levels"
            referencedColumns: ["id", "trial_id"]
          },
          {
            foreignKeyName: "treatment_factor_levels_treatment_fkey"
            columns: ["treatment_id", "trial_id"]
            isOneToOne: false
            referencedRelation: "treatments"
            referencedColumns: ["id", "trial_id"]
          },
          {
            foreignKeyName: "treatment_factor_levels_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          active_ingredient: string | null
          created_at: string
          dose: number | null
          dose_unit: string | null
          formulation: string | null
          id: string
          name: string
          number: number
          product: string | null
          timing: string | null
          trial_id: string
          updated_at: string
        }
        Insert: {
          active_ingredient?: string | null
          created_at?: string
          dose?: number | null
          dose_unit?: string | null
          formulation?: string | null
          id?: string
          name: string
          number: number
          product?: string | null
          timing?: string | null
          trial_id: string
          updated_at?: string
        }
        Update: {
          active_ingredient?: string | null
          created_at?: string
          dose?: number | null
          dose_unit?: string | null
          formulation?: string | null
          id?: string
          name?: string
          number?: number
          product?: string | null
          timing?: string | null
          trial_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatments_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_members: {
        Row: {
          created_at: string
          id: string
          trial_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          trial_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          trial_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_members_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trials: {
        Row: {
          code: string
          contractor: string | null
          created_at: string
          created_by: string | null
          crop: string | null
          design: Database["public"]["Enums"]["trial_design"] | null
          id: string
          location: string | null
          planned_end_date: string | null
          planned_start_date: string | null
          randomization_seed: number | null
          status: string
          technical_lead: string | null
          updated_at: string
        }
        Insert: {
          code: string
          contractor?: string | null
          created_at?: string
          created_by?: string | null
          crop?: string | null
          design?: Database["public"]["Enums"]["trial_design"] | null
          id?: string
          location?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          randomization_seed?: number | null
          status?: string
          technical_lead?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          contractor?: string | null
          created_at?: string
          created_by?: string | null
          crop?: string | null
          design?: Database["public"]["Enums"]["trial_design"] | null
          id?: string
          location?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          randomization_seed?: number | null
          status?: string
          technical_lead?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_record_field_data: { Args: { p_trial_id: string }; Returns: boolean }
      can_review_trial: { Args: { p_trial_id: string }; Returns: boolean }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_trial_access: { Args: { p_trial_id: string }; Returns: boolean }
      is_coordination: { Args: never; Returns: boolean }
      is_trial_member: { Args: { p_trial_id: string }; Returns: boolean }
      storage_object_trial_id: { Args: { p_name: string }; Returns: string }
    }
    Enums: {
      app_role: "coordination" | "field" | "home_office"
      trial_design: "dbc" | "dic" | "factorial" | "split_plot"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["coordination", "field", "home_office"],
      trial_design: ["dbc", "dic", "factorial", "split_plot"],
    },
  },
} as const
