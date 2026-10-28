export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      prepared_transactions: {
        Row: { tx_hash: string; profile_id: string; entity_id: string; method: string; expires_at: string; confirmed_at: string | null; result: Json | null; created_at: string };
        Insert: { tx_hash: string; profile_id: string; entity_id: string; method: string; expires_at: string; confirmed_at?: string | null; result?: Json | null; created_at?: string };
        Update: { confirmed_at?: string | null; result?: Json | null };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          data: Json | null;
          entity: string;
          entity_id: string | null;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          data?: Json | null;
          entity: string;
          entity_id?: string | null;
          id?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          data?: Json | null;
          entity?: string;
          entity_id?: string | null;
          id?: never;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_rate_limits: {
        Row: {
          hits: number;
          key: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          hits?: number;
          key: string;
          window_start?: string;
        };
        Update: {
          hits?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      collateral_events: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          ledger: number;
          loan_id: string | null;
          position_onchain_id: number | null;
          to_address: string | null;
          tx_hash: string;
          type: Database["public"]["Enums"]["collateral_event_type"];
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          ledger: number;
          loan_id?: string | null;
          position_onchain_id?: number | null;
          to_address?: string | null;
          tx_hash: string;
          type: Database["public"]["Enums"]["collateral_event_type"];
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          ledger?: number;
          loan_id?: string | null;
          position_onchain_id?: number | null;
          to_address?: string | null;
          tx_hash?: string;
          type?: Database["public"]["Enums"]["collateral_event_type"];
        };
        Relationships: [
          {
            foreignKeyName: "collateral_events_loan_id_fkey";
            columns: ["loan_id"];
            isOneToOne: false;
            referencedRelation: "loans";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_profiles: {
        Row: {
          borrower_address: string;
          credential_id: string | null;
          credential_issued_at: string | null;
          defaults: number;
          late_payments: number;
          on_time_payments: number;
          profile_id: string;
          score: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          borrower_address: string;
          credential_id?: string | null;
          credential_issued_at?: string | null;
          defaults?: number;
          late_payments?: number;
          on_time_payments?: number;
          profile_id: string;
          score?: number;
          updated_at?: string;
        };
        Update: {
          borrower_address?: string;
          credential_id?: string | null;
          credential_issued_at?: string | null;
          defaults?: number;
          late_payments?: number;
          on_time_payments?: number;
          profile_id?: string;
          score?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      guarantor_invitations: {
        Row: {
          code: string;
          created_at: string;
          expires_at: string;
          guarantor_email: string;
          guarantor_id: string | null;
          id: string;
          status: Database["public"]["Enums"]["invitation_status"];
          student_id: string;
        };
        ComputedFields: never;
        Insert: {
          code?: string;
          created_at?: string;
          expires_at?: string;
          guarantor_email: string;
          guarantor_id?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["invitation_status"];
          student_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          expires_at?: string;
          guarantor_email?: string;
          guarantor_id?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["invitation_status"];
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guarantor_invitations_guarantor_id_fkey";
            columns: ["guarantor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guarantor_invitations_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      indexer_lock: {
        Row: {
          holder: string | null;
          id: boolean;
          locked_until: string | null;
        };
        ComputedFields: never;
        Insert: {
          holder?: string | null;
          id?: boolean;
          locked_until?: string | null;
        };
        Update: {
          holder?: string | null;
          id?: boolean;
          locked_until?: string | null;
        };
        Relationships: [];
      };
      indexer_state: {
        Row: {
          last_cursor: string | null;
          contract_id: string;
          last_ledger: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          last_cursor?: string | null;
          contract_id: string;
          last_ledger?: number;
          updated_at?: string;
        };
        Update: {
          last_cursor?: string | null;
          contract_id?: string;
          last_ledger?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      installments: {
        Row: {
          due_at: string;
          id: string;
          interest_due: number;
          loan_id: string;
          number: number;
          paid_at: string | null;
          principal_due: number;
          status: Database["public"]["Enums"]["installment_status"];
        };
        ComputedFields: never;
        Insert: {
          due_at: string;
          id?: string;
          interest_due: number;
          loan_id: string;
          number: number;
          paid_at?: string | null;
          principal_due: number;
          status?: Database["public"]["Enums"]["installment_status"];
        };
        Update: {
          due_at?: string;
          id?: string;
          interest_due?: number;
          loan_id?: string;
          number?: number;
          paid_at?: string | null;
          principal_due?: number;
          status?: Database["public"]["Enums"]["installment_status"];
        };
        Relationships: [
          {
            foreignKeyName: "installments_loan_id_fkey";
            columns: ["loan_id"];
            isOneToOne: false;
            referencedRelation: "loans";
            referencedColumns: ["id"];
          },
        ];
      };
      kyc_submissions: {
        Row: {
          created_at: string;
          document_paths: string[];
          id: string;
          profile_id: string;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          sep12_fields: NonNullable<Json>;
          status: Database["public"]["Enums"]["kyc_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          document_paths?: string[];
          id?: string;
          profile_id: string;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          sep12_fields?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["kyc_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          document_paths?: string[];
          id?: string;
          profile_id?: string;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          sep12_fields?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["kyc_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kyc_submissions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kyc_submissions_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      loan_applications: {
        Row: {
          amount_usd: number;
          asset_contract_id: string;
          collateral_amount: number;
          created_at: string;
          guarantor_id: string | null;
          id: string;
          installments: number;
          purpose: Database["public"]["Enums"]["loan_purpose"];
          purpose_detail: string | null;
          rate_bps: number;
          rejection_reason: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["application_status"];
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_usd: number;
          asset_contract_id: string;
          collateral_amount: number;
          created_at?: string;
          guarantor_id?: string | null;
          id?: string;
          installments: number;
          purpose?: Database["public"]["Enums"]["loan_purpose"];
          purpose_detail?: string | null;
          rate_bps: number;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          amount_usd?: number;
          asset_contract_id?: string;
          collateral_amount?: number;
          created_at?: string;
          guarantor_id?: string | null;
          id?: string;
          installments?: number;
          purpose?: Database["public"]["Enums"]["loan_purpose"];
          purpose_detail?: string | null;
          rate_bps?: number;
          rejection_reason?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loan_applications_guarantor_id_fkey";
            columns: ["guarantor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loan_applications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loan_applications_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      loans: {
        Row: {
          application_id: string | null;
          asset_contract_id: string;
          borrower_address: string;
          closed_at: string | null;
          collateral_initial: number;
          collateral_locked: number;
          collateral_released: number;
          depositor_address: string;
          id: string;
          installments: number;
          interest_paid: number;
          loan_contract_id: string;
          onchain_loan_id: number;
          onchain_position_id: number | null;
          opened_at: string | null;
          opened_tx_hash: string | null;
          origination_fee: number;
          outstanding: number;
          principal: number;
          principal_paid: number;
          rate_bps: number;
          status: Database["public"]["Enums"]["loan_status"];
          student_id: string | null;
          updated_at: string;
          yield_accrued: number;
          yield_to_depositor: number;
        };
        ComputedFields: never;
        Insert: {
          application_id?: string | null;
          asset_contract_id: string;
          borrower_address: string;
          closed_at?: string | null;
          collateral_initial: number;
          collateral_locked: number;
          collateral_released?: number;
          depositor_address: string;
          id?: string;
          installments: number;
          interest_paid?: number;
          loan_contract_id: string;
          onchain_loan_id: number;
          onchain_position_id?: number | null;
          opened_at?: string | null;
          opened_tx_hash?: string | null;
          origination_fee?: number;
          outstanding: number;
          principal: number;
          principal_paid?: number;
          rate_bps: number;
          status?: Database["public"]["Enums"]["loan_status"];
          student_id?: string | null;
          updated_at?: string;
          yield_accrued?: number;
          yield_to_depositor?: number;
        };
        Update: {
          application_id?: string | null;
          asset_contract_id?: string;
          borrower_address?: string;
          closed_at?: string | null;
          collateral_initial?: number;
          collateral_locked?: number;
          collateral_released?: number;
          depositor_address?: string;
          id?: string;
          installments?: number;
          interest_paid?: number;
          loan_contract_id?: string;
          onchain_loan_id?: number;
          onchain_position_id?: number | null;
          opened_at?: string | null;
          opened_tx_hash?: string | null;
          origination_fee?: number;
          outstanding?: number;
          principal?: number;
          principal_paid?: number;
          rate_bps?: number;
          status?: Database["public"]["Enums"]["loan_status"];
          student_id?: string | null;
          updated_at?: string;
          yield_accrued?: number;
          yield_to_depositor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "loans_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: true;
            referencedRelation: "loan_applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loans_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          channel: string;
          created_at: string;
          id: string;
          payload: NonNullable<Json>;
          profile_id: string;
          read_at: string | null;
          sent_at: string | null;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          channel?: string;
          created_at?: string;
          id?: string;
          payload?: NonNullable<Json>;
          profile_id: string;
          read_at?: string | null;
          sent_at?: string | null;
          type: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          id?: string;
          payload?: NonNullable<Json>;
          profile_id?: string;
          read_at?: string | null;
          sent_at?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      onchain_events: {
        Row: {
          contract_id: string;
          created_at: string;
          event_index: number;
          event_type: string;
          id: string;
          ledger: number;
          payload: NonNullable<Json>;
          processed: boolean;
          tx_hash: string;
        };
        ComputedFields: never;
        Insert: {
          contract_id: string;
          created_at?: string;
          event_index?: number;
          event_type: string;
          id?: string;
          ledger: number;
          payload: NonNullable<Json>;
          processed?: boolean;
          tx_hash: string;
        };
        Update: {
          contract_id?: string;
          created_at?: string;
          event_index?: number;
          event_type?: string;
          id?: string;
          ledger?: number;
          payload?: NonNullable<Json>;
          processed?: boolean;
          tx_hash?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          created_at: string;
          id: string;
          installment_id: string | null;
          interest: number;
          ledger: number;
          loan_id: string;
          on_time: boolean | null;
          principal: number;
          tx_hash: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          installment_id?: string | null;
          interest?: number;
          ledger: number;
          loan_id: string;
          on_time?: boolean | null;
          principal: number;
          tx_hash: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          installment_id?: string | null;
          interest?: number;
          ledger?: number;
          loan_id?: string;
          on_time?: boolean | null;
          principal?: number;
          tx_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_installment_id_fkey";
            columns: ["installment_id"];
            isOneToOne: false;
            referencedRelation: "installments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_loan_id_fkey";
            columns: ["loan_id"];
            isOneToOne: false;
            referencedRelation: "loans";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_revenue: {
        Row: {
          amount_usd: number;
          created_at: string;
          id: string;
          loan_id: string | null;
          payment_id: string | null;
          tx_hash: string | null;
          type: Database["public"]["Enums"]["revenue_type"];
        };
        ComputedFields: never;
        Insert: {
          amount_usd: number;
          created_at?: string;
          id?: string;
          loan_id?: string | null;
          payment_id?: string | null;
          tx_hash?: string | null;
          type: Database["public"]["Enums"]["revenue_type"];
        };
        Update: {
          amount_usd?: number;
          created_at?: string;
          id?: string;
          loan_id?: string | null;
          payment_id?: string | null;
          tx_hash?: string | null;
          type?: Database["public"]["Enums"]["revenue_type"];
        };
        Relationships: [
          {
            foreignKeyName: "platform_revenue_loan_id_fkey";
            columns: ["loan_id"];
            isOneToOne: false;
            referencedRelation: "loans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_revenue_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_settings: {
        Row: {
          grace_seconds: number;
          id: boolean;
          late_fee_bps: number;
          max_amount_usd: number;
          max_installments: number;
          max_ltv_bps: number;
          min_amount_usd: number;
          origination_fee_bps: number;
          rate_bps: number;
          updated_at: string;
          yield_share_platform_bps: number;
        };
        ComputedFields: never;
        Insert: {
          grace_seconds?: number;
          id?: boolean;
          late_fee_bps?: number;
          max_amount_usd?: number;
          max_installments?: number;
          max_ltv_bps?: number;
          min_amount_usd?: number;
          origination_fee_bps?: number;
          rate_bps?: number;
          updated_at?: string;
          yield_share_platform_bps?: number;
        };
        Update: {
          grace_seconds?: number;
          id?: boolean;
          late_fee_bps?: number;
          max_amount_usd?: number;
          max_installments?: number;
          max_ltv_bps?: number;
          min_amount_usd?: number;
          origination_fee_bps?: number;
          rate_bps?: number;
          updated_at?: string;
          yield_share_platform_bps?: number;
        };
        Relationships: [];
      };
      pool_movements: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          ledger: number | null;
          loan_id: string | null;
          note: string | null;
          tx_hash: string | null;
          type: Database["public"]["Enums"]["pool_movement_type"];
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          ledger?: number | null;
          loan_id?: string | null;
          note?: string | null;
          tx_hash?: string | null;
          type: Database["public"]["Enums"]["pool_movement_type"];
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          ledger?: number | null;
          loan_id?: string | null;
          note?: string | null;
          tx_hash?: string | null;
          type?: Database["public"]["Enums"]["pool_movement_type"];
        };
        Relationships: [
          {
            foreignKeyName: "pool_movements_loan_id_fkey";
            columns: ["loan_id"];
            isOneToOne: false;
            referencedRelation: "loans";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          document_hash: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          document_hash?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          document_hash?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      student_profiles: {
        Row: {
          career: string | null;
          created_at: string;
          enrollment_doc_path: string | null;
          profile_id: string;
          semester: number | null;
          student_code: string | null;
          university_name: string;
          verified_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          career?: string | null;
          created_at?: string;
          enrollment_doc_path?: string | null;
          profile_id: string;
          semester?: number | null;
          student_code?: string | null;
          university_name: string;
          verified_at?: string | null;
        };
        Update: {
          career?: string | null;
          created_at?: string;
          enrollment_doc_path?: string | null;
          profile_id?: string;
          semester?: number | null;
          student_code?: string | null;
          university_name?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      wallets: {
        Row: {
          address: string;
          created_at: string;
          id: string;
          is_primary: boolean;
          profile_id: string;
          sep10_verified_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          address: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          profile_id: string;
          sep10_verified_at?: string | null;
        };
        Update: {
          address?: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          profile_id?: string;
          sep10_verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wallets_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_platform_revenue: {
        Row: {
          month: string | null;
          total_usd: number | null;
          type: Database["public"]["Enums"]["revenue_type"];
        };
        ComputedFields: never;
        Relationships: [];
      };
      v_pool_balance: {
        Row: {
          available_usd: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      auth_rate_limit_hit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
      indexer_acquire_lock: { Args: { p_holder: string; p_seconds?: number }; Returns: boolean };
      indexer_release_lock: { Args: { p_holder: string }; Returns: undefined };
      is_staff_platform: { Args: Record<PropertyKey, never>; Returns: boolean };
      my_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
    };
    Enums: {
      application_status: "draft" | "submitted" | "approved" | "rejected" | "cancelled" | "opened";
      collateral_event_type: "deposit" | "release" | "liquidation" | "return" | "withdraw";
      installment_status: "pending" | "paid" | "late" | "waived";
      invitation_status: "pending" | "accepted" | "expired" | "revoked";
      kyc_status: "draft" | "pending" | "approved" | "rejected";
      loan_purpose: "tuition" | "laptop" | "course" | "materials" | "other";
      loan_status: "active" | "repaid" | "defaulted" | "liquidated" | "cancelled";
      pool_movement_type: "fund" | "withdraw" | "disburse" | "repay_principal";
      revenue_type: "interest" | "origination" | "late_fee" | "yield_share";
      user_role: "student" | "guarantor" | "operator" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      application_status: ["draft", "submitted", "approved", "rejected", "cancelled", "opened"],
      collateral_event_type: ["deposit", "release", "liquidation", "return", "withdraw"],
      installment_status: ["pending", "paid", "late", "waived"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      kyc_status: ["draft", "pending", "approved", "rejected"],
      loan_purpose: ["tuition", "laptop", "course", "materials", "other"],
      loan_status: ["active", "repaid", "defaulted", "liquidated", "cancelled"],
      pool_movement_type: ["fund", "withdraw", "disburse", "repay_principal"],
      revenue_type: ["interest", "origination", "late_fee", "yield_share"],
      user_role: ["student", "guarantor", "operator", "admin"],
    },
  },
} as const;
