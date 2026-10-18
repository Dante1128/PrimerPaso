// Tipos de la base de datos de Supabase (esquema `public`).
// Generado desde el esquema real del proyecto con el mismo formato que
// `supabase gen types typescript`. Para regenerar con la CLI:
//   npx supabase gen types typescript --project-id bgactooctcxesjxpvwam > app/lib/database.types.ts
// No editar a mano.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: number
          actor_id: string | null
          action: string
          entity: string
          entity_id: string | null
          data: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          actor_id?: string | null
          action: string
          entity: string
          entity_id?: string | null
          data?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          actor_id?: string | null
          action?: string
          entity?: string
          entity_id?: string | null
          data?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collateral_events: {
        Row: {
          id: string
          loan_id: string | null
          position_onchain_id: number | null
          type: Database["public"]["Enums"]["collateral_event_type"]
          amount: number
          to_address: string | null
          tx_hash: string
          ledger: number
          created_at: string
        }
        Insert: {
          id?: string
          loan_id?: string | null
          position_onchain_id?: number | null
          type: Database["public"]["Enums"]["collateral_event_type"]
          amount: number
          to_address?: string | null
          tx_hash: string
          ledger: number
          created_at?: string
        }
        Update: {
          id?: string
          loan_id?: string | null
          position_onchain_id?: number | null
          type?: Database["public"]["Enums"]["collateral_event_type"]
          amount?: number
          to_address?: string | null
          tx_hash?: string
          ledger?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collateral_events_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_profiles: {
        Row: {
          profile_id: string
          borrower_address: string
          score: number
          on_time_payments: number
          late_payments: number
          defaults: number
          credential_id: string | null
          credential_issued_at: string | null
          updated_at: string
        }
        Insert: {
          profile_id: string
          borrower_address: string
          score?: number
          on_time_payments?: number
          late_payments?: number
          defaults?: number
          credential_id?: string | null
          credential_issued_at?: string | null
          updated_at?: string
        }
        Update: {
          profile_id?: string
          borrower_address?: string
          score?: number
          on_time_payments?: number
          late_payments?: number
          defaults?: number
          credential_id?: string | null
          credential_issued_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guarantor_invitations: {
        Row: {
          id: string
          student_id: string
          guarantor_email: string
          guarantor_id: string | null
          code: string
          status: Database["public"]["Enums"]["invitation_status"]
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          guarantor_email: string
          guarantor_id?: string | null
          code?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          guarantor_email?: string
          guarantor_id?: string | null
          code?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          expires_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guarantor_invitations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guarantor_invitations_guarantor_id_fkey"
            columns: ["guarantor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      indexer_state: {
        Row: {
          contract_id: string
          last_ledger: number
          updated_at: string
        }
        Insert: {
          contract_id: string
          last_ledger?: number
          updated_at?: string
        }
        Update: {
          contract_id?: string
          last_ledger?: number
          updated_at?: string
        }
        Relationships: [
        ]
      }
      installments: {
        Row: {
          id: string
          loan_id: string
          number: number
          due_at: string
          principal_due: number
          interest_due: number
          paid_at: string | null
          status: Database["public"]["Enums"]["installment_status"]
        }
        Insert: {
          id?: string
          loan_id: string
          number: number
          due_at: string
          principal_due: number
          interest_due: number
          paid_at?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
        }
        Update: {
          id?: string
          loan_id?: string
          number?: number
          due_at?: string
          principal_due?: number
          interest_due?: number
          paid_at?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_submissions: {
        Row: {
          id: string
          profile_id: string
          status: Database["public"]["Enums"]["kyc_status"]
          sep12_fields: Json
          document_paths: string[]
          reviewed_by: string | null
          reviewed_at: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          status?: Database["public"]["Enums"]["kyc_status"]
          sep12_fields: Json
          document_paths: string[]
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["kyc_status"]
          sep12_fields?: Json
          document_paths?: string[]
          reviewed_by?: string | null
          reviewed_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_submissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_applications: {
        Row: {
          id: string
          student_id: string
          guarantor_id: string | null
          purpose: Database["public"]["Enums"]["loan_purpose"]
          purpose_detail: string | null
          amount_usd: number
          collateral_amount: number
          asset_contract_id: string
          rate_bps: number
          installments: number
          status: Database["public"]["Enums"]["application_status"]
          reviewed_by: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          guarantor_id?: string | null
          purpose?: Database["public"]["Enums"]["loan_purpose"]
          purpose_detail?: string | null
          amount_usd: number
          collateral_amount: number
          asset_contract_id: string
          rate_bps: number
          installments: number
          status?: Database["public"]["Enums"]["application_status"]
          reviewed_by?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          guarantor_id?: string | null
          purpose?: Database["public"]["Enums"]["loan_purpose"]
          purpose_detail?: string | null
          amount_usd?: number
          collateral_amount?: number
          asset_contract_id?: string
          rate_bps?: number
          installments?: number
          status?: Database["public"]["Enums"]["application_status"]
          reviewed_by?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_guarantor_id_fkey"
            columns: ["guarantor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          id: string
          application_id: string | null
          onchain_loan_id: number
          onchain_position_id: number | null
          loan_contract_id: string
          student_id: string | null
          borrower_address: string
          depositor_address: string
          asset_contract_id: string
          principal: number
          origination_fee: number
          collateral_initial: number
          collateral_locked: number
          collateral_released: number
          principal_paid: number
          interest_paid: number
          outstanding: number
          yield_accrued: number
          yield_to_depositor: number
          rate_bps: number
          installments: number
          status: Database["public"]["Enums"]["loan_status"]
          opened_tx_hash: string | null
          opened_at: string | null
          closed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          application_id?: string | null
          onchain_loan_id: number
          onchain_position_id?: number | null
          loan_contract_id: string
          student_id?: string | null
          borrower_address: string
          depositor_address: string
          asset_contract_id: string
          principal: number
          origination_fee?: number
          collateral_initial: number
          collateral_locked: number
          collateral_released?: number
          principal_paid?: number
          interest_paid?: number
          outstanding: number
          yield_accrued?: number
          yield_to_depositor?: number
          rate_bps: number
          installments: number
          status?: Database["public"]["Enums"]["loan_status"]
          opened_tx_hash?: string | null
          opened_at?: string | null
          closed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          application_id?: string | null
          onchain_loan_id?: number
          onchain_position_id?: number | null
          loan_contract_id?: string
          student_id?: string | null
          borrower_address?: string
          depositor_address?: string
          asset_contract_id?: string
          principal?: number
          origination_fee?: number
          collateral_initial?: number
          collateral_locked?: number
          collateral_released?: number
          principal_paid?: number
          interest_paid?: number
          outstanding?: number
          yield_accrued?: number
          yield_to_depositor?: number
          rate_bps?: number
          installments?: number
          status?: Database["public"]["Enums"]["loan_status"]
          opened_tx_hash?: string | null
          opened_at?: string | null
          closed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          profile_id: string
          type: string
          channel: string
          payload: Json
          read_at: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          type: string
          channel?: string
          payload: Json
          read_at?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          type?: string
          channel?: string
          payload?: Json
          read_at?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onchain_events: {
        Row: {
          id: string
          contract_id: string
          event_type: string
          ledger: number
          tx_hash: string
          event_index: number
          payload: Json
          processed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          event_type: string
          ledger: number
          tx_hash: string
          event_index?: number
          payload: Json
          processed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          event_type?: string
          ledger?: number
          tx_hash?: string
          event_index?: number
          payload?: Json
          processed?: boolean
          created_at?: string
        }
        Relationships: [
        ]
      }
      payments: {
        Row: {
          id: string
          loan_id: string
          installment_id: string | null
          principal: number
          interest: number
          on_time: boolean | null
          tx_hash: string
          ledger: number
          created_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          installment_id?: string | null
          principal: number
          interest?: number
          on_time?: boolean | null
          tx_hash: string
          ledger: number
          created_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          installment_id?: string | null
          principal?: number
          interest?: number
          on_time?: boolean | null
          tx_hash?: string
          ledger?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_revenue: {
        Row: {
          id: string
          loan_id: string | null
          payment_id: string | null
          type: Database["public"]["Enums"]["revenue_type"]
          amount_usd: number
          tx_hash: string | null
          created_at: string
        }
        Insert: {
          id?: string
          loan_id?: string | null
          payment_id?: string | null
          type: Database["public"]["Enums"]["revenue_type"]
          amount_usd: number
          tx_hash?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          loan_id?: string | null
          payment_id?: string | null
          type?: Database["public"]["Enums"]["revenue_type"]
          amount_usd?: number
          tx_hash?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_revenue_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_revenue_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: boolean
          max_ltv_bps: number
          rate_bps: number
          origination_fee_bps: number
          late_fee_bps: number
          yield_share_platform_bps: number
          grace_seconds: number
          min_amount_usd: number
          max_amount_usd: number
          max_installments: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          max_ltv_bps?: number
          rate_bps?: number
          origination_fee_bps?: number
          late_fee_bps?: number
          yield_share_platform_bps?: number
          grace_seconds?: number
          min_amount_usd?: number
          max_amount_usd?: number
          max_installments?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          max_ltv_bps?: number
          rate_bps?: number
          origination_fee_bps?: number
          late_fee_bps?: number
          yield_share_platform_bps?: number
          grace_seconds?: number
          min_amount_usd?: number
          max_amount_usd?: number
          max_installments?: number
          updated_at?: string
        }
        Relationships: [
        ]
      }
      pool_movements: {
        Row: {
          id: string
          type: Database["public"]["Enums"]["pool_movement_type"]
          amount: number
          loan_id: string | null
          tx_hash: string | null
          ledger: number | null
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          type: Database["public"]["Enums"]["pool_movement_type"]
          amount: number
          loan_id?: string | null
          tx_hash?: string | null
          ledger?: number | null
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          type?: Database["public"]["Enums"]["pool_movement_type"]
          amount?: number
          loan_id?: string | null
          tx_hash?: string | null
          ledger?: number | null
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_movements_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          document_hash: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          document_hash?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          document_hash?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
        ]
      }
      student_profiles: {
        Row: {
          profile_id: string
          university_name: string
          career: string | null
          student_code: string | null
          semester: number | null
          enrollment_doc_path: string | null
          verified_at: string | null
          created_at: string
        }
        Insert: {
          profile_id: string
          university_name: string
          career?: string | null
          student_code?: string | null
          semester?: number | null
          enrollment_doc_path?: string | null
          verified_at?: string | null
          created_at?: string
        }
        Update: {
          profile_id?: string
          university_name?: string
          career?: string | null
          student_code?: string | null
          semester?: number | null
          enrollment_doc_path?: string | null
          verified_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          id: string
          profile_id: string
          address: string
          sep10_verified_at: string | null
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          address: string
          sep10_verified_at?: string | null
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          address?: string
          sep10_verified_at?: string | null
          is_primary?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_platform_revenue: {
        Row: {
          month: string | null
          type: Database["public"]["Enums"]["revenue_type"] | null
          total_usd: number | null
        }
        Relationships: [
        ]
      }
      v_pool_balance: {
        Row: {
          available_usd: number | null
        }
        Relationships: [
        ]
      }
    }
    Functions: {
      is_staff_platform: { Args: never; Returns: boolean }
      my_role: { Args: never; Returns: Database["public"]["Enums"]["user_role"] }
    }
    Enums: {
      application_status: "draft" | "submitted" | "approved" | "rejected" | "cancelled" | "opened"
      collateral_event_type: "deposit" | "release" | "liquidation" | "return" | "withdraw"
      installment_status: "pending" | "paid" | "late" | "waived"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      kyc_status: "draft" | "pending" | "approved" | "rejected"
      loan_purpose: "tuition" | "laptop" | "course" | "materials" | "other"
      loan_status: "active" | "repaid" | "defaulted" | "liquidated" | "cancelled"
      pool_movement_type: "fund" | "withdraw" | "disburse" | "repay_principal"
      revenue_type: "interest" | "origination" | "late_fee" | "yield_share"
      user_role: "student" | "guarantor" | "operator" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

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
} as const
