export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      ai_usage: {
        Row: {
          id: string
          org_id: string
          usage_date: string
          generation_count: number
          daily_limit: number
        }
        Insert: {
          id?: string
          org_id: string
          usage_date?: string
          generation_count?: number
          daily_limit: number
        }
        Update: {
          id?: string
          org_id?: string
          usage_date?: string
          generation_count?: number
          daily_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_enrollments: {
        Row: {
          id: string
          cadence_id: string
          lead_id: string
          current_step: number
          status: Database["public"]["Enums"]["enrollment_status"]
          next_step_due: string | null
          enrolled_by: string | null
          enrolled_at: string
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          cadence_id: string
          lead_id: string
          current_step?: number
          status?: Database["public"]["Enums"]["enrollment_status"]
          next_step_due?: string | null
          enrolled_by?: string | null
          enrolled_at?: string
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          cadence_id?: string
          lead_id?: string
          current_step?: number
          status?: Database["public"]["Enums"]["enrollment_status"]
          next_step_due?: string | null
          enrolled_by?: string | null
          enrolled_at?: string
          completed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadence_enrollments_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_enrollments_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_steps: {
        Row: {
          id: string
          cadence_id: string
          step_order: number
          channel: Database["public"]["Enums"]["channel_type"]
          template_id: string | null
          delay_days: number
          delay_hours: number
          ai_personalization: boolean
          created_at: string
        }
        Insert: {
          id?: string
          cadence_id: string
          step_order: number
          channel: Database["public"]["Enums"]["channel_type"]
          template_id?: string | null
          delay_days?: number
          delay_hours?: number
          ai_personalization?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          cadence_id?: string
          step_order?: number
          channel?: Database["public"]["Enums"]["channel_type"]
          template_id?: string | null
          delay_days?: number
          delay_hours?: number
          ai_personalization?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadence_steps_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cadences: {
        Row: {
          id: string
          org_id: string
          name: string
          description: string | null
          status: Database["public"]["Enums"]["cadence_status"]
          total_steps: number
          created_by: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          description?: string | null
          status?: Database["public"]["Enums"]["cadence_status"]
          total_steps?: number
          created_by?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          description?: string | null
          status?: Database["public"]["Enums"]["cadence_status"]
          total_steps?: number
          created_by?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          id: string
          org_id: string
          user_id: string
          access_token_encrypted: string
          refresh_token_encrypted: string
          token_expires_at: string
          calendar_email: string
          status: Database["public"]["Enums"]["connection_status"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          access_token_encrypted: string
          refresh_token_encrypted: string
          token_expires_at: string
          calendar_email: string
          status?: Database["public"]["Enums"]["connection_status"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          access_token_encrypted?: string
          refresh_token_encrypted?: string
          token_expires_at?: string
          calendar_email?: string
          status?: Database["public"]["Enums"]["connection_status"]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_connections: {
        Row: {
          id: string
          org_id: string
          crm_provider: Database["public"]["Enums"]["crm_type"]
          credentials_encrypted: Json
          field_mapping: Json | null
          status: Database["public"]["Enums"]["connection_status"]
          last_sync_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          crm_provider: Database["public"]["Enums"]["crm_type"]
          credentials_encrypted: Json
          field_mapping?: Json | null
          status?: Database["public"]["Enums"]["connection_status"]
          last_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          crm_provider?: Database["public"]["Enums"]["crm_type"]
          credentials_encrypted?: Json
          field_mapping?: Json | null
          status?: Database["public"]["Enums"]["connection_status"]
          last_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sync_log: {
        Row: {
          id: string
          connection_id: string
          direction: Database["public"]["Enums"]["sync_direction"]
          records_synced: number
          errors: number
          duration_ms: number | null
          error_details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          connection_id: string
          direction: Database["public"]["Enums"]["sync_direction"]
          records_synced?: number
          errors?: number
          duration_ms?: number | null
          error_details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          connection_id?: string
          direction?: Database["public"]["Enums"]["sync_direction"]
          records_synced?: number
          errors?: number
          duration_ms?: number | null
          error_details?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_sync_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "crm_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_attempts: {
        Row: {
          id: string
          lead_id: string
          provider: string
          status: Database["public"]["Enums"]["enrichment_status"]
          response_data: Json | null
          error_message: string | null
          duration_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          provider: string
          status: Database["public"]["Enums"]["enrichment_status"]
          response_data?: Json | null
          error_message?: string | null
          duration_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          provider?: string
          status?: Database["public"]["Enums"]["enrichment_status"]
          response_data?: Json | null
          error_message?: string | null
          duration_ms?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_attempts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_connections: {
        Row: {
          id: string
          org_id: string
          user_id: string
          access_token_encrypted: string
          refresh_token_encrypted: string
          token_expires_at: string
          email_address: string
          status: Database["public"]["Enums"]["connection_status"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          access_token_encrypted: string
          refresh_token_encrypted: string
          token_expires_at: string
          email_address: string
          status?: Database["public"]["Enums"]["connection_status"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          access_token_encrypted?: string
          refresh_token_encrypted?: string
          token_expires_at?: string
          email_address?: string
          status?: Database["public"]["Enums"]["connection_status"]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          id: string
          org_id: string
          lead_id: string
          cadence_id: string | null
          step_id: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          type: Database["public"]["Enums"]["interaction_type"]
          message_content: string | null
          external_id: string | null
          metadata: Json | null
          ai_generated: boolean
          original_template_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          lead_id: string
          cadence_id?: string | null
          step_id?: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          type: Database["public"]["Enums"]["interaction_type"]
          message_content?: string | null
          external_id?: string | null
          metadata?: Json | null
          ai_generated?: boolean
          original_template_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          lead_id?: string
          cadence_id?: string | null
          step_id?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          type?: Database["public"]["Enums"]["interaction_type"]
          message_content?: string | null
          external_id?: string | null
          metadata?: Json | null
          ai_generated?: boolean
          original_template_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "cadence_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_original_template_id_fkey"
            columns: ["original_template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_import_errors: {
        Row: {
          id: string
          import_id: string
          row_number: number
          cnpj: string | null
          error_message: string
          created_at: string
        }
        Insert: {
          id?: string
          import_id: string
          row_number: number
          cnpj?: string | null
          error_message: string
          created_at?: string
        }
        Update: {
          id?: string
          import_id?: string
          row_number?: number
          cnpj?: string | null
          error_message?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_import_errors_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "lead_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_imports: {
        Row: {
          id: string
          org_id: string
          file_name: string
          total_rows: number
          processed_rows: number
          success_count: number
          error_count: number
          status: Database["public"]["Enums"]["import_status"]
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          file_name: string
          total_rows?: number
          processed_rows?: number
          success_count?: number
          error_count?: number
          status?: Database["public"]["Enums"]["import_status"]
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          file_name?: string
          total_rows?: number
          processed_rows?: number
          success_count?: number
          error_count?: number
          status?: Database["public"]["Enums"]["import_status"]
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_imports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_imports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          id: string
          org_id: string
          cnpj: string
          status: Database["public"]["Enums"]["lead_status"]
          enrichment_status: Database["public"]["Enums"]["enrichment_status"]
          razao_social: string | null
          nome_fantasia: string | null
          endereco: Json | null
          porte: string | null
          cnae: string | null
          situacao_cadastral: string | null
          email: string | null
          telefone: string | null
          socios: Json | null
          faturamento_estimado: number | null
          notes: string | null
          enriched_at: string | null
          created_by: string | null
          import_id: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          cnpj: string
          status?: Database["public"]["Enums"]["lead_status"]
          enrichment_status?: Database["public"]["Enums"]["enrichment_status"]
          razao_social?: string | null
          nome_fantasia?: string | null
          endereco?: Json | null
          porte?: string | null
          cnae?: string | null
          situacao_cadastral?: string | null
          email?: string | null
          telefone?: string | null
          socios?: Json | null
          faturamento_estimado?: number | null
          notes?: string | null
          enriched_at?: string | null
          created_by?: string | null
          import_id?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          cnpj?: string
          status?: Database["public"]["Enums"]["lead_status"]
          enrichment_status?: Database["public"]["Enums"]["enrichment_status"]
          razao_social?: string | null
          nome_fantasia?: string | null
          endereco?: Json | null
          porte?: string | null
          cnae?: string | null
          situacao_cadastral?: string | null
          email?: string | null
          telefone?: string | null
          socios?: Json | null
          faturamento_estimado?: number | null
          notes?: string | null
          enriched_at?: string | null
          created_by?: string | null
          import_id?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "lead_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          id: string
          org_id: string
          name: string
          channel: Database["public"]["Enums"]["channel_type"]
          subject: string | null
          body: string
          variables_used: string[]
          is_system: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          channel: Database["public"]["Enums"]["channel_type"]
          subject?: string | null
          body: string
          variables_used?: string[]
          is_system?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          channel?: Database["public"]["Enums"]["channel_type"]
          subject?: string | null
          body?: string
          variables_used?: string[]
          is_system?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          org_id: string
          user_id: string
          type: Database["public"]["Enums"]["notification_type"]
          title: string
          body: string | null
          read_at: string | null
          resource_type: string | null
          resource_id: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          type: Database["public"]["Enums"]["notification_type"]
          title: string
          body?: string | null
          read_at?: string | null
          resource_type?: string | null
          resource_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
          title?: string
          body?: string | null
          read_at?: string | null
          resource_type?: string | null
          resource_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          invited_at: string
          accepted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          invited_at?: string
          accepted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          invited_at?: string
          accepted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          id: string
          name: string
          slug: string
          price_cents: number
          max_leads: number
          max_ai_per_day: number
          max_whatsapp_per_month: number
          included_users: number
          additional_user_price_cents: number
          features: Json
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          price_cents: number
          max_leads: number
          max_ai_per_day: number
          max_whatsapp_per_month: number
          included_users?: number
          additional_user_price_cents: number
          features?: Json
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          price_cents?: number
          max_leads?: number
          max_ai_per_day?: number
          max_whatsapp_per_month?: number
          included_users?: number
          additional_user_price_cents?: number
          features?: Json
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          org_id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          current_period_start: string
          current_period_end: string
          stripe_subscription_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          current_period_start?: string
          current_period_end?: string
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          current_period_start?: string
          current_period_end?: string
          stripe_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          id: string
          org_id: string
          phone_number_id: string
          business_account_id: string
          access_token_encrypted: string
          status: Database["public"]["Enums"]["connection_status"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          phone_number_id: string
          business_account_id: string
          access_token_encrypted: string
          status?: Database["public"]["Enums"]["connection_status"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          phone_number_id?: string
          business_account_id?: string
          access_token_encrypted?: string
          status?: Database["public"]["Enums"]["connection_status"]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_credits: {
        Row: {
          id: string
          org_id: string
          plan_credits: number
          used_credits: number
          overage_count: number
          period: string
        }
        Insert: {
          id?: string
          org_id: string
          plan_credits?: number
          used_credits?: number
          overage_count?: number
          period: string
        }
        Update: {
          id?: string
          org_id?: string
          plan_credits?: number
          used_credits?: number
          overage_count?: number
          period?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_credits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_org_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_manager: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      member_role: "manager" | "sdr"
      member_status: "invited" | "active" | "suspended" | "removed"
      lead_status: "new" | "contacted" | "qualified" | "unqualified" | "archived"
      enrichment_status: "pending" | "enriching" | "enriched" | "enrichment_failed" | "not_found"
      import_status: "processing" | "completed" | "failed"
      cadence_status: "draft" | "active" | "paused" | "archived"
      enrollment_status: "active" | "paused" | "completed" | "replied" | "bounced" | "unsubscribed"
      channel_type: "email" | "whatsapp"
      interaction_type: "sent" | "delivered" | "opened" | "clicked" | "replied" | "bounced" | "failed" | "meeting_scheduled"
      crm_type: "hubspot" | "pipedrive" | "rdstation"
      connection_status: "connected" | "disconnected" | "error" | "syncing"
      subscription_status: "active" | "past_due" | "canceled" | "trialing"
      sync_direction: "push" | "pull"
      notification_type: "lead_replied" | "lead_opened" | "lead_clicked" | "lead_bounced" | "sync_completed" | "integration_error" | "member_invited" | "member_joined" | "usage_limit_alert"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
