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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      branding_sync: {
        Row: {
          auto_sync: boolean | null
          branding_config: Json
          created_at: string | null
          id: string
          last_synced_at: string | null
          site_type: string
          synced_by: string | null
          updated_at: string | null
        }
        Insert: {
          auto_sync?: boolean | null
          branding_config: Json
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          site_type: string
          synced_by?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_sync?: boolean | null
          branding_config?: Json
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          site_type?: string
          synced_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cross_site_sync_log: {
        Row: {
          completed_at: string | null
          created_at: string | null
          details: Json | null
          id: string
          source_site: string
          status: string
          sync_type: string
          synced_by: string | null
          target_sites: string[]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          source_site: string
          status?: string
          sync_type: string
          synced_by?: string | null
          target_sites: string[]
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          source_site?: string
          status?: string
          sync_type?: string
          synced_by?: string | null
          target_sites?: string[]
        }
        Relationships: []
      }
      email_delivery_status: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          resend_email_id: string
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          resend_email_id: string
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          resend_email_id?: string
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          email_type: string
          error_context: Json | null
          html_body: string
          id: string
          last_error: string | null
          max_attempts: number | null
          next_retry_at: string | null
          recipient_email: string
          related_id: string | null
          resend_email_id: string | null
          status: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          email_type: string
          error_context?: Json | null
          html_body: string
          id?: string
          last_error?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          recipient_email: string
          related_id?: string | null
          resend_email_id?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          email_type?: string
          error_context?: Json | null
          html_body?: string
          id?: string
          last_error?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          recipient_email?: string
          related_id?: string | null
          resend_email_id?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      event_tag_map: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tag_map_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_vip_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_tag_map_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tag_map_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "event_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tags: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      event_vip_configs: {
        Row: {
          created_at: string | null
          disclaimer_text: string | null
          event_id: string
          id: string
          refund_policy_text: string | null
          updated_at: string | null
          vip_enabled: boolean | null
        }
        Insert: {
          created_at?: string | null
          disclaimer_text?: string | null
          event_id: string
          id?: string
          refund_policy_text?: string | null
          updated_at?: string | null
          vip_enabled?: boolean | null
        }
        Update: {
          created_at?: string | null
          disclaimer_text?: string | null
          event_id?: string
          id?: string
          refund_policy_text?: string | null
          updated_at?: string | null
          vip_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_vip_configs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "event_vip_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_vip_configs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_vip_tables: {
        Row: {
          bottles_included: number | null
          capacity: number
          champagne_included: number | null
          created_at: string | null
          display_order: number | null
          event_id: string
          id: string
          is_available: boolean | null
          package_description: string | null
          price_cents: number
          table_number: number
          table_template_id: string
          tier: Database["public"]["Enums"]["table_tier"]
          updated_at: string | null
        }
        Insert: {
          bottles_included?: number | null
          capacity: number
          champagne_included?: number | null
          created_at?: string | null
          display_order?: number | null
          event_id: string
          id?: string
          is_available?: boolean | null
          package_description?: string | null
          price_cents: number
          table_number: number
          table_template_id: string
          tier: Database["public"]["Enums"]["table_tier"]
          updated_at?: string | null
        }
        Update: {
          bottles_included?: number | null
          capacity?: number
          champagne_included?: number | null
          created_at?: string | null
          display_order?: number | null
          event_id?: string
          id?: string
          is_available?: boolean | null
          package_description?: string | null
          price_cents?: number
          table_number?: number
          table_template_id?: string
          tier?: Database["public"]["Enums"]["table_tier"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_vip_tables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_vip_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_vip_tables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_vip_tables_table_template_id_fkey"
            columns: ["table_template_id"]
            isOneToOne: false
            referencedRelation: "vip_table_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          artist_description: string | null
          artist_name: string | null
          banner_url: string | null
          cancellation_reason: string | null
          cancellation_status: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          categories: string[] | null
          city: string | null
          created_at: string
          description: string | null
          event_category: string | null
          event_date: string
          event_time: string
          genre: string | null
          id: string
          image_url: string | null
          is_active: boolean
          metadata: Json | null
          name: string
          newsletter_sent_at: string | null
          newsletter_sent_count: number | null
          published_at: string | null
          status: string | null
          tags: string[] | null
          updated_at: string
          venue_address: string | null
          venue_name: string | null
          vip_configured_at: string | null
          vip_configured_by: string | null
          vip_enabled: boolean | null
        }
        Insert: {
          artist_description?: string | null
          artist_name?: string | null
          banner_url?: string | null
          cancellation_reason?: string | null
          cancellation_status?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          categories?: string[] | null
          city?: string | null
          created_at?: string
          description?: string | null
          event_category?: string | null
          event_date: string
          event_time: string
          genre?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json | null
          name: string
          newsletter_sent_at?: string | null
          newsletter_sent_count?: number | null
          published_at?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          vip_configured_at?: string | null
          vip_configured_by?: string | null
          vip_enabled?: boolean | null
        }
        Update: {
          artist_description?: string | null
          artist_name?: string | null
          banner_url?: string | null
          cancellation_reason?: string | null
          cancellation_status?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          categories?: string[] | null
          city?: string | null
          created_at?: string
          description?: string | null
          event_category?: string | null
          event_date?: string
          event_time?: string
          genre?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json | null
          name?: string
          newsletter_sent_at?: string | null
          newsletter_sent_count?: number | null
          published_at?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          vip_configured_at?: string | null
          vip_configured_by?: string | null
          vip_enabled?: boolean | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string | null
          created_by: string
          expires_at: string
          id: string
          metadata: Json | null
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          expires_at: string
          id?: string
          metadata?: Json | null
          token: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          expires_at?: string
          id?: string
          metadata?: Json | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          is_active: boolean | null
          source: string | null
          subscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          is_active?: boolean | null
          source?: string | null
          subscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          is_active?: boolean | null
          source?: string | null
          subscribed_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          event_id: string
          fees_total: number
          id: string
          metadata: Json | null
          payment_provider: string | null
          payment_reference: string | null
          promo_code_id: string | null
          purchaser_email: string
          purchaser_name: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          fees_total?: number
          id?: string
          metadata?: Json | null
          payment_provider?: string | null
          payment_reference?: string | null
          promo_code_id?: string | null
          purchaser_email: string
          purchaser_name?: string | null
          status?: string
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          fees_total?: number
          id?: string
          metadata?: Json | null
          payment_provider?: string | null
          payment_reference?: string | null
          promo_code_id?: string | null
          purchaser_email?: string
          purchaser_name?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_vip_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      query_performance_logs: {
        Row: {
          context: Json | null
          duration_ms: number
          id: string
          index_used: string | null
          occurred_at: string
          query_hash: string
          query_text: string
          rows_examined: number | null
          rows_returned: number | null
          session_id: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          duration_ms: number
          id?: string
          index_used?: string | null
          occurred_at?: string
          query_hash: string
          query_text: string
          rows_examined?: number | null
          rows_returned?: number | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          duration_ms?: number
          id?: string
          index_used?: string | null
          occurred_at?: string
          query_hash?: string
          query_text?: string
          rows_examined?: number | null
          rows_returned?: number | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      revenue_discrepancies: {
        Row: {
          checked_at: string
          db_revenue: number
          discrepancy_amount: number
          discrepancy_percent: number | null
          event_id: string | null
          id: string
          metadata: Json | null
          period_end: string | null
          period_start: string | null
          resolution_notes: string | null
          resolved_at: string | null
          stripe_revenue: number
        }
        Insert: {
          checked_at?: string
          db_revenue: number
          discrepancy_amount: number
          discrepancy_percent?: number | null
          event_id?: string | null
          id?: string
          metadata?: Json | null
          period_end?: string | null
          period_start?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          stripe_revenue: number
        }
        Update: {
          checked_at?: string
          db_revenue?: number
          discrepancy_amount?: number
          discrepancy_percent?: number | null
          event_id?: string | null
          id?: string
          metadata?: Json | null
          period_end?: string | null
          period_start?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          stripe_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_discrepancies_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_vip_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "revenue_discrepancies_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      saga_executions: {
        Row: {
          compensation_errors: Json | null
          completed_at: string | null
          context_snapshot: Json
          created_at: string
          current_step: string | null
          duration_ms: number | null
          error_details: Json | null
          id: string
          input_data: Json | null
          saga_id: string
          saga_name: string
          started_at: string
          status: Database["public"]["Enums"]["saga_status"]
          steps_compensated: string[] | null
          steps_completed: string[]
          updated_at: string
        }
        Insert: {
          compensation_errors?: Json | null
          completed_at?: string | null
          context_snapshot?: Json
          created_at?: string
          current_step?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          id?: string
          input_data?: Json | null
          saga_id: string
          saga_name: string
          started_at?: string
          status?: Database["public"]["Enums"]["saga_status"]
          steps_compensated?: string[] | null
          steps_completed?: string[]
          updated_at?: string
        }
        Update: {
          compensation_errors?: Json | null
          completed_at?: string | null
          context_snapshot?: Json
          created_at?: string
          current_step?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          id?: string
          input_data?: Json | null
          saga_id?: string
          saga_name?: string
          started_at?: string
          status?: Database["public"]["Enums"]["saga_status"]
          steps_compensated?: string[] | null
          steps_completed?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      scan_history: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          notes: string | null
          scan_type: string
          scanned_at: string
          scanned_by: string | null
          ticket_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          notes?: string | null
          scan_type: string
          scanned_at?: string
          scanned_by?: string | null
          ticket_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          notes?: string | null
          scan_type?: string
          scanned_at?: string
          scanned_by?: string | null
          ticket_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_logs: {
        Row: {
          device_id: string | null
          id: string
          metadata: Json | null
          scan_method: string | null
          scan_result: string
          scan_success: boolean | null
          scanned_at: string
          scanned_by: string | null
          ticket_id: string | null
        }
        Insert: {
          device_id?: string | null
          id?: string
          metadata?: Json | null
          scan_method?: string | null
          scan_result: string
          scan_success?: boolean | null
          scanned_at?: string
          scanned_by?: string | null
          ticket_id?: string | null
        }
        Update: {
          device_id?: string | null
          id?: string
          metadata?: Json | null
          scan_method?: string | null
          scan_result?: string
          scan_success?: boolean | null
          scanned_at?: string
          scanned_by?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scan_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      scanner_heartbeats: {
        Row: {
          created_at: string
          current_event_id: string | null
          current_event_name: string | null
          device_id: string
          device_name: string | null
          is_online: boolean
          last_heartbeat: string
          pending_scans: number
          scans_today: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_event_id?: string | null
          current_event_name?: string | null
          device_id: string
          device_name?: string | null
          is_online?: boolean
          last_heartbeat?: string
          pending_scans?: number
          scans_today?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_event_id?: string | null
          current_event_name?: string | null
          device_id?: string
          device_name?: string | null
          is_online?: boolean
          last_heartbeat?: string
          pending_scans?: number
          scans_today?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scanner_heartbeats_current_event_id_fkey"
            columns: ["current_event_id"]
            isOneToOne: false
            referencedRelation: "event_vip_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "scanner_heartbeats_current_event_id_fkey"
            columns: ["current_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          event_count: number | null
          id: string
          metadata: Json | null
          notes: string | null
          recent_events: Json | null
          severity: string
          source_ip: string | null
          timestamp: string
          type: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          event_count?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          recent_events?: Json | null
          severity?: string
          source_ip?: string | null
          timestamp?: string
          type: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          event_count?: number | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          recent_events?: Json | null
          severity?: string
          source_ip?: string | null
          timestamp?: string
          type?: string
        }
        Relationships: []
      }
      security_event_logs: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          request_timestamp: string | null
          signature_prefix: string | null
          source_ip: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          request_timestamp?: string | null
          signature_prefix?: string | null
          source_ip?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          request_timestamp?: string | null
          signature_prefix?: string | null
          source_ip?: string | null
        }
        Relationships: []
      }
      site_content: {
        Row: {
          content: string
          content_key: string
          content_type: string
          created_at: string | null
          id: string
          is_published: boolean | null
          metadata: Json | null
          published_at: string | null
          site_type: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          content_key: string
          content_type: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          metadata?: Json | null
          published_at?: string | null
          site_type?: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          content_key?: string
          content_type?: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          metadata?: Json | null
          published_at?: string | null
          site_type?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      site_environment_config: {
        Row: {
          config_key: string
          config_value_encrypted: string | null
          created_at: string | null
          description: string | null
          environment: string
          id: string
          is_secret: boolean | null
          site_type: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value_encrypted?: string | null
          created_at?: string | null
          description?: string | null
          environment?: string
          id?: string
          is_secret?: boolean | null
          site_type: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value_encrypted?: string | null
          created_at?: string | null
          description?: string | null
          environment?: string
          id?: string
          is_secret?: boolean | null
          site_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sites: {
        Row: {
          created_at: string | null
          description: string | null
          environment: string
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          site_type: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          environment?: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          site_type: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          environment?: string
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          site_type?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      ticket_events: {
        Row: {
          aggregate_id: string
          causation_id: string | null
          correlation_id: string | null
          event_data: Json
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          recorded_at: string
          schema_version: number
          sequence_number: number
        }
        Insert: {
          aggregate_id: string
          causation_id?: string | null
          correlation_id?: string | null
          event_data?: Json
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          recorded_at?: string
          schema_version?: number
          sequence_number: number
        }
        Update: {
          aggregate_id?: string
          causation_id?: string | null
          correlation_id?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          recorded_at?: string
          schema_version?: number
          sequence_number?: number
        }
        Relationships: []
      }
      ticket_scan_logs: {
        Row: {
          id: number
          metadata: Json | null
          scan_result: string
          scan_source: string | null
          scanned_at: string
          scanned_by: string | null
          ticket_id: string
        }
        Insert: {
          id?: number
          metadata?: Json | null
          scan_result: string
          scan_source?: string | null
          scanned_at?: string
          scanned_by?: string | null
          ticket_id: string
        }
        Update: {
          id?: number
          metadata?: Json | null
          scan_result?: string
          scan_source?: string | null
          scanned_at?: string
          scanned_by?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_scan_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          event_id: string
          fee: number
          id: string
          limit_per_order: number
          name: string
          price: number
          tickets_sold: number
          total_inventory: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          event_id: string
          fee?: number
          id?: string
          limit_per_order?: number
          name: string
          price: number
          tickets_sold?: number
          total_inventory?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          event_id?: string
          fee?: number
          id?: string
          limit_per_order?: number
          name?: string
          price?: number
          tickets_sold?: number
          total_inventory?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_vip_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          attendee_email: string | null
          attendee_name: string
          created_at: string
          current_status: string | null
          entry_count: number | null
          event_id: string
          event_name: string | null
          exit_count: number | null
          fee_total: number | null
          guest_email: string | null
          guest_name: string | null
          id: string
          is_used: boolean | null
          issued_at: string
          last_entry_at: string | null
          last_exit_at: string | null
          metadata: Json | null
          order_id: string
          price: number | null
          purchase_date: string | null
          qr_code_data: string | null
          qr_code_url: string | null
          qr_code_value: string | null
          qr_signature: string | null
          qr_token: string
          scanned_at: string | null
          scanned_by: string | null
          seat_label: string | null
          status: string
          ticket_id: string | null
          ticket_type: string | null
          ticket_type_id: string
          updated_at: string
        }
        Insert: {
          attendee_email?: string | null
          attendee_name: string
          created_at?: string
          current_status?: string | null
          entry_count?: number | null
          event_id: string
          event_name?: string | null
          exit_count?: number | null
          fee_total?: number | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          is_used?: boolean | null
          issued_at?: string
          last_entry_at?: string | null
          last_exit_at?: string | null
          metadata?: Json | null
          order_id: string
          price?: number | null
          purchase_date?: string | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          qr_code_value?: string | null
          qr_signature?: string | null
          qr_token: string
          scanned_at?: string | null
          scanned_by?: string | null
          seat_label?: string | null
          status?: string
          ticket_id?: string | null
          ticket_type?: string | null
          ticket_type_id: string
          updated_at?: string
        }
        Update: {
          attendee_email?: string | null
          attendee_name?: string
          created_at?: string
          current_status?: string | null
          entry_count?: number | null
          event_id?: string
          event_name?: string | null
          exit_count?: number | null
          fee_total?: number | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          is_used?: boolean | null
          issued_at?: string
          last_entry_at?: string | null
          last_exit_at?: string | null
          metadata?: Json | null
          order_id?: string
          price?: number | null
          purchase_date?: string | null
          qr_code_data?: string | null
          qr_code_url?: string | null
          qr_code_value?: string | null
          qr_signature?: string | null
          qr_token?: string
          scanned_at?: string | null
          scanned_by?: string | null
          seat_label?: string | null
          status?: string
          ticket_id?: string | null
          ticket_type?: string | null
          ticket_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_vip_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_branding: {
        Row: {
          accent_color: string
          created_at: string
          custom_css: string | null
          favicon_url: string | null
          font_family: string
          id: string
          logo_square_url: string | null
          logo_url: string | null
          primary_color: string
          secondary_color: string
          settings: Json
          theme_preset: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          custom_css?: string | null
          favicon_url?: string | null
          font_family?: string
          id?: string
          logo_square_url?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          settings?: Json
          theme_preset?: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          custom_css?: string | null
          favicon_url?: string | null
          font_family?: string
          id?: string
          logo_square_url?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          settings?: Json
          theme_preset?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_branding_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          created_at: string
          custom_domain: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          settings: Json
          slug: string | null
          subdomain: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          settings?: Json
          slug?: string | null
          subdomain?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          settings?: Json
          slug?: string | null
          subdomain?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vip_guest_passes: {
        Row: {
          created_at: string | null
          event_id: string
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          pass_number: number
          pass_type: string
          qr_signature: string | null
          qr_token: string
          reservation_id: string
          scan_location: string | null
          scanned_at: string | null
          scanned_by: string | null
          shared_at: string | null
          shared_via: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          pass_number: number
          pass_type?: string
          qr_signature?: string | null
          qr_token?: string
          reservation_id: string
          scan_location?: string | null
          scanned_at?: string | null
          scanned_by?: string | null
          shared_at?: string | null
          shared_via?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          pass_number?: number
          pass_type?: string
          qr_signature?: string | null
          qr_token?: string
          reservation_id?: string
          scan_location?: string | null
          scanned_at?: string | null
          scanned_by?: string | null
          shared_at?: string | null
          shared_via?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vip_guest_passes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_vip_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "vip_guest_passes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_guest_passes_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "vip_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_linked_tickets: {
        Row: {
          created_at: string | null
          id: string
          is_booker_purchase: boolean | null
          order_id: string
          purchased_by_email: string
          purchased_by_name: string | null
          ticket_id: string
          vip_reservation_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_booker_purchase?: boolean | null
          order_id: string
          purchased_by_email: string
          purchased_by_name?: string | null
          ticket_id: string
          vip_reservation_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_booker_purchase?: boolean | null
          order_id?: string
          purchased_by_email?: string
          purchased_by_name?: string | null
          ticket_id?: string
          vip_reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vip_linked_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_linked_tickets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_linked_tickets_vip_reservation_id_fkey"
            columns: ["vip_reservation_id"]
            isOneToOne: false
            referencedRelation: "vip_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_reservations: {
        Row: {
          amount_paid_cents: number
          cancellation_reason: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          checked_in_guests: number | null
          confirmed_at: string | null
          created_at: string | null
          disclaimer_accepted_at: string
          event_id: string
          event_vip_table_id: string
          id: string
          internal_notes: string | null
          invite_code: string | null
          package_snapshot: Json
          purchaser_email: string
          purchaser_name: string
          purchaser_phone: string | null
          purchaser_ticket_id: string | null
          qr_code_token: string
          refund_id: string | null
          refund_policy_accepted_at: string
          refunded_at: string | null
          special_requests: string | null
          status: Database["public"]["Enums"]["vip_reservation_status"] | null
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          table_number: number
          updated_at: string | null
        }
        Insert: {
          amount_paid_cents: number
          cancellation_reason?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_in_guests?: number | null
          confirmed_at?: string | null
          created_at?: string | null
          disclaimer_accepted_at: string
          event_id: string
          event_vip_table_id: string
          id?: string
          internal_notes?: string | null
          invite_code?: string | null
          package_snapshot: Json
          purchaser_email: string
          purchaser_name: string
          purchaser_phone?: string | null
          purchaser_ticket_id?: string | null
          qr_code_token: string
          refund_id?: string | null
          refund_policy_accepted_at: string
          refunded_at?: string | null
          special_requests?: string | null
          status?: Database["public"]["Enums"]["vip_reservation_status"] | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          table_number: number
          updated_at?: string | null
        }
        Update: {
          amount_paid_cents?: number
          cancellation_reason?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_in_guests?: number | null
          confirmed_at?: string | null
          created_at?: string | null
          disclaimer_accepted_at?: string
          event_id?: string
          event_vip_table_id?: string
          id?: string
          internal_notes?: string | null
          invite_code?: string | null
          package_snapshot?: Json
          purchaser_email?: string
          purchaser_name?: string
          purchaser_phone?: string | null
          purchaser_ticket_id?: string | null
          qr_code_token?: string
          refund_id?: string | null
          refund_policy_accepted_at?: string
          refunded_at?: string | null
          special_requests?: string | null
          status?: Database["public"]["Enums"]["vip_reservation_status"] | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          table_number?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vip_reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_vip_summary"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "vip_reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_reservations_event_vip_table_id_fkey"
            columns: ["event_vip_table_id"]
            isOneToOne: false
            referencedRelation: "event_vip_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_reservations_purchaser_ticket_id_fkey"
            columns: ["purchaser_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_scan_logs: {
        Row: {
          created_at: string | null
          id: string
          pass_id: string | null
          reservation_id: string | null
          scan_type: string
          scanned_at: string | null
          scanned_by: string | null
          ticket_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          pass_id?: string | null
          reservation_id?: string | null
          scan_type: string
          scanned_at?: string | null
          scanned_by?: string | null
          ticket_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          pass_id?: string | null
          reservation_id?: string | null
          scan_type?: string
          scanned_at?: string | null
          scanned_by?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vip_scan_logs_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "vip_guest_passes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_scan_logs_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "vip_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_scan_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_table_templates: {
        Row: {
          created_at: string | null
          default_capacity: number
          default_tier: Database["public"]["Enums"]["table_tier"]
          id: string
          position_row: number | null
          position_x: number | null
          position_y: number | null
          table_number: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_capacity: number
          default_tier: Database["public"]["Enums"]["table_tier"]
          id?: string
          position_row?: number | null
          position_x?: number | null
          position_y?: number | null
          table_number: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_capacity?: number
          default_tier?: Database["public"]["Enums"]["table_tier"]
          id?: string
          position_row?: number | null
          position_x?: number | null
          position_y?: number | null
          table_number?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          event_type: string
          expires_at: string
          id: string
          payload_hash: string | null
          signature_hash: string
          source_ip: string | null
          timestamp: string
        }
        Insert: {
          created_at?: string
          event_type?: string
          expires_at: string
          id?: string
          payload_hash?: string | null
          signature_hash: string
          source_ip?: string | null
          timestamp: string
        }
        Update: {
          created_at?: string
          event_type?: string
          expires_at?: string
          id?: string
          payload_hash?: string | null
          signature_hash?: string
          source_ip?: string | null
          timestamp?: string
        }
        Relationships: []
      }
      webhook_idempotency: {
        Row: {
          expires_at: string
          id: string
          idempotency_key: string
          metadata: Json | null
          processed_at: string
          response_data: Json | null
          response_status: number | null
          webhook_type: string
        }
        Insert: {
          expires_at?: string
          id?: string
          idempotency_key: string
          metadata?: Json | null
          processed_at?: string
          response_data?: Json | null
          response_status?: number | null
          webhook_type: string
        }
        Update: {
          expires_at?: string
          id?: string
          idempotency_key?: string
          metadata?: Json | null
          processed_at?: string
          response_data?: Json | null
          response_status?: number | null
          webhook_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      event_vip_summary: {
        Row: {
          available_tables: number | null
          event_date: string | null
          event_id: string | null
          event_name: string | null
          reserved_tables: number | null
          total_actual_revenue_cents: number | null
          total_potential_revenue_cents: number | null
          total_tables: number | null
          vip_enabled: boolean | null
        }
        Relationships: []
      }
      index_usage_stats: {
        Row: {
          index_size: string | null
          indexname: unknown
          schemaname: unknown
          tablename: unknown
          times_used: number | null
          tuples_fetched: number | null
          tuples_read: number | null
          usage_category: string | null
        }
        Relationships: []
      }
      recent_saga_failures: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          failed_step: string | null
          saga_id: string | null
          saga_name: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["saga_status"] | null
          steps_compensated: string[] | null
          steps_completed: string[] | null
        }
        Relationships: []
      }
      saga_execution_summary: {
        Row: {
          avg_duration_ms: number | null
          compensated: number | null
          compensation_failed: number | null
          completed: number | null
          failed: number | null
          last_execution: string | null
          running: number | null
          saga_name: string | null
          total_executions: number | null
        }
        Relationships: []
      }
      security_events_summary: {
        Row: {
          event_count: number | null
          event_type: string | null
          first_seen: string | null
          last_seen: string | null
          source_ip: string | null
        }
        Relationships: []
      }
      slow_query_summary: {
        Row: {
          avg_duration_ms: number | null
          execution_count: number | null
          last_occurred: string | null
          max_duration_ms: number | null
          min_duration_ms: number | null
          p95_duration_ms: number | null
          query_hash: string | null
          query_preview: string | null
          source: string | null
        }
        Relationships: []
      }
      unacknowledged_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          event_count: number | null
          id: string | null
          metadata: Json | null
          notes: string | null
          recent_events: Json | null
          severity: string | null
          source_ip: string | null
          timestamp: string | null
          type: string | null
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          event_count?: number | null
          id?: string | null
          metadata?: Json | null
          notes?: string | null
          recent_events?: Json | null
          severity?: string | null
          source_ip?: string | null
          timestamp?: string | null
          type?: string | null
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          event_count?: number | null
          id?: string | null
          metadata?: Json | null
          notes?: string | null
          recent_events?: Json | null
          severity?: string | null
          source_ip?: string | null
          timestamp?: string | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      append_ticket_event: {
        Args: {
          p_aggregate_id: string
          p_causation_id?: string
          p_correlation_id?: string
          p_event_data: Json
          p_event_type: string
          p_metadata?: Json
          p_occurred_at?: string
        }
        Returns: {
          aggregate_id: string
          causation_id: string | null
          correlation_id: string | null
          event_data: Json
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          recorded_at: string
          schema_version: number
          sequence_number: number
        }
        SetofOptions: {
          from: "*"
          to: "ticket_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_reservations_to_order: {
        Args: { p_order_id: string; p_reservation_ids: string[] }
        Returns: undefined
      }
      can_cancel_event: {
        Args: { p_event_id: string }
        Returns: {
          can_cancel: boolean
          event_date: string
          event_status: string
          event_time: string
          reason: string
          refundable_count: number
          total_refund_cents: number
        }[]
      }
      check_and_reserve_tickets: {
        Args: { p_quantity: number; p_ticket_type_id: string }
        Returns: {
          available: number
          error_message: string
          reserved: number
          success: boolean
          ticket_type_name: string
        }[]
      }
      check_in_vip_guest_atomic: {
        Args: { p_checked_in_by?: string; p_pass_id: string }
        Returns: Json
      }
      check_in_vip_reservation: {
        Args: { p_checked_in_by?: string; p_qr_code_token: string }
        Returns: {
          error_message: string
          package_snapshot: Json
          purchaser_name: string
          reservation_id: string
          success: boolean
          table_number: number
        }[]
      }
      check_vip_capacity: {
        Args: { p_requested_tickets?: number; p_reservation_id: string }
        Returns: Json
      }
      check_vip_linked_ticket_reentry: {
        Args: { p_ticket_id: string }
        Returns: Json
      }
      check_webhook_idempotency: {
        Args: { p_idempotency_key: string; p_webhook_type: string }
        Returns: {
          cached_response: Json
          cached_status: number
          is_duplicate: boolean
          record_id: string
        }[]
      }
      check_webhook_replay: {
        Args: { p_signature_hash: string }
        Returns: boolean
      }
      claim_pending_emails: {
        Args: { p_batch_size?: number }
        Returns: {
          attempt_count: number | null
          created_at: string | null
          email_type: string
          error_context: Json | null
          html_body: string
          id: string
          last_error: string | null
          max_attempts: number | null
          next_retry_at: string | null
          recipient_email: string
          related_id: string | null
          resend_email_id: string | null
          status: string | null
          subject: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "email_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_expired_webhook_events: { Args: never; Returns: number }
      cleanup_expired_webhook_idempotency: { Args: never; Returns: number }
      cleanup_old_query_logs: {
        Args: { days_to_keep?: number }
        Returns: number
      }
      cleanup_old_saga_executions: {
        Args: { p_days_to_keep?: number }
        Returns: number
      }
      complete_saga_execution: {
        Args: { p_context_snapshot?: Json; p_saga_id: string }
        Returns: undefined
      }
      copy_vip_setup: {
        Args: { p_source_event_id: string; p_target_event_id: string }
        Returns: boolean
      }
      create_order_with_tickets_atomic: {
        Args: {
          p_attendee_email?: string
          p_attendee_name?: string
          p_event_id: string
          p_fees_total: number
          p_line_items: Json
          p_metadata?: Json
          p_promo_code_id?: string
          p_purchaser_email: string
          p_purchaser_name: string
          p_qr_signing_secret?: string
          p_status?: string
          p_subtotal: number
          p_total: number
          p_user_id?: string
        }
        Returns: {
          order_data: Json
          order_id: string
          ticket_email_payloads: Json
          tickets_data: Json
        }[]
      }
      create_saga_execution: {
        Args: { p_input_data?: Json; p_saga_id: string; p_saga_name: string }
        Returns: string
      }
      create_unified_vip_checkout: {
        Args: {
          p_event_id: string
          p_package_snapshot: Json
          p_purchaser_email: string
          p_purchaser_name: string
          p_purchaser_phone: string
          p_special_requests?: string
          p_stripe_payment_intent_id: string
          p_table_id: string
          p_table_number: number
          p_tier_id: string
          p_tier_name: string
          p_tier_price_cents: number
          p_total_amount_cents: number
          p_vip_price_cents: number
        }
        Returns: {
          reservation_id: string
          ticket_id: string
          ticket_token: string
          unified_qr_token: string
        }[]
      }
      create_vip_reservation: {
        Args: {
          p_amount_paid_cents: number
          p_event_id: string
          p_event_vip_table_id: string
          p_purchaser_email: string
          p_purchaser_name: string
          p_purchaser_phone: string
          p_special_requests?: string
          p_stripe_payment_intent_id: string
        }
        Returns: {
          error_message: string
          qr_code_token: string
          reservation_id: string
          success: boolean
        }[]
      }
      enqueue_email: {
        Args: {
          p_email_type: string
          p_html_body: string
          p_recipient_email: string
          p_related_id?: string
          p_subject: string
        }
        Returns: string
      }
      expire_stale_reservations: { Args: never; Returns: undefined }
      fail_saga_execution: {
        Args: {
          p_error_message: string
          p_error_stack?: string
          p_failed_step: string
          p_saga_id: string
        }
        Returns: undefined
      }
      finalize_saga_compensation: {
        Args: { p_saga_id: string }
        Returns: undefined
      }
      generate_human_readable_ticket_id: {
        Args: { p_event_id: string; p_index: number; p_order_id: string }
        Returns: string
      }
      generate_qr_signature: {
        Args: { p_secret: string; p_token: string }
        Returns: string
      }
      generate_vip_invite_code: { Args: never; Returns: string }
      get_available_vip_tables: {
        Args: { p_event_id: string }
        Returns: {
          bottles_included: number
          capacity: number
          champagne_included: number
          is_reserved: boolean
          package_description: string
          price_cents: number
          table_id: string
          table_number: number
          tier: Database["public"]["Enums"]["table_tier"]
        }[]
      }
      get_event_availability: {
        Args: { event_name_param: string }
        Returns: {
          event_name: string
          ticket_types: Json
          tickets_available: number
          tickets_sold: number
          total_capacity: number
        }[]
      }
      get_event_refundable_reservations: {
        Args: { p_event_id: string }
        Returns: {
          amount_paid_cents: number
          created_at: string
          purchaser_email: string
          purchaser_name: string
          reservation_id: string
          status: string
          stripe_payment_intent_id: string
          table_number: number
        }[]
      }
      get_latest_ticket_event: {
        Args: { p_aggregate_id: string }
        Returns: {
          aggregate_id: string
          causation_id: string | null
          correlation_id: string | null
          event_data: Json
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          recorded_at: string
          schema_version: number
          sequence_number: number
        }
        SetofOptions: {
          from: "*"
          to: "ticket_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_next_sequence_number: {
        Args: { p_aggregate_id: string }
        Returns: number
      }
      get_security_event_count: {
        Args: { p_hours?: number; p_source_ip: string }
        Returns: number
      }
      get_ticket_availability: {
        Args: { p_ticket_type_id: string }
        Returns: {
          available: number
          sold: number
          ticket_type_id: string
          ticket_type_name: string
          total_inventory: number
        }[]
      }
      get_ticket_count_by_type: {
        Args: { event_name_param: string; ticket_type_param: string }
        Returns: number
      }
      get_ticket_events: {
        Args: {
          p_aggregate_id: string
          p_from_sequence?: number
          p_limit?: number
        }
        Returns: {
          aggregate_id: string
          causation_id: string | null
          correlation_id: string | null
          event_data: Json
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          recorded_at: string
          schema_version: number
          sequence_number: number
        }[]
        SetofOptions: {
          from: "*"
          to: "ticket_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_vip_linked_ticket_count: {
        Args: { p_reservation_id: string }
        Returns: number
      }
      increment_vip_checked_in: {
        Args: { p_reservation_id: string }
        Returns: Json
      }
      is_vip_table_available: {
        Args: { p_event_vip_table_id: string }
        Returns: boolean
      }
      link_ticket_to_vip: {
        Args: {
          p_email: string
          p_is_booker?: boolean
          p_name?: string
          p_order_id: string
          p_ticket_id: string
          p_vip_reservation_id: string
        }
        Returns: Json
      }
      log_security_event: {
        Args: {
          p_details?: Json
          p_event_type: string
          p_request_timestamp?: string
          p_signature_prefix?: string
          p_source_ip: string
        }
        Returns: string
      }
      log_slow_query: {
        Args: {
          p_context?: Json
          p_duration_ms: number
          p_index_used?: string
          p_query_text: string
          p_rows_examined?: number
          p_rows_returned?: number
          p_source?: string
        }
        Returns: string
      }
      mark_email_failed: {
        Args: { p_email_id: string; p_error: string; p_error_context?: Json }
        Returns: undefined
      }
      mark_email_sent: {
        Args: { p_email_id: string; p_resend_email_id: string }
        Returns: undefined
      }
      process_vip_scan_with_reentry: {
        Args: { p_pass_id: string; p_scanned_by?: string }
        Returns: Json
      }
      record_email_delivery_event: {
        Args: {
          p_event_data?: Json
          p_event_type: string
          p_resend_email_id: string
        }
        Returns: undefined
      }
      record_saga_compensation: {
        Args: {
          p_compensated_step: string
          p_error_message?: string
          p_saga_id: string
        }
        Returns: undefined
      }
      record_webhook_signature: {
        Args: {
          p_event_type: string
          p_expires_at: string
          p_payload_hash?: string
          p_signature_hash: string
          p_source_ip: string
          p_timestamp: string
        }
        Returns: string
      }
      release_reservation: {
        Args: { p_reason?: string; p_reservation_id: string }
        Returns: undefined
      }
      release_reserved_tickets: {
        Args: { p_quantity: number; p_ticket_type_id: string }
        Returns: {
          error_message: string
          new_tickets_sold: number
          released: number
          success: boolean
        }[]
      }
      release_tickets_batch: {
        Args: { p_reservations: Json }
        Returns: boolean
      }
      reserve_ticket_inventory: {
        Args: {
          p_customer_email: string
          p_event_id: string
          p_hold_minutes: number
          p_quantity: number
          p_ticket_type_id: string
        }
        Returns: Json
      }
      reserve_tickets_batch: {
        Args: { p_reservations: Json }
        Returns: {
          available_quantity: number
          error_message: string
          failed_ticket_type_id: string
          failed_ticket_type_name: string
          requested_quantity: number
          success: boolean
        }[]
      }
      reset_vip_test_state: {
        Args: { p_reservation_id: string }
        Returns: Json
      }
      scan_ticket_atomic: {
        Args: {
          p_device_id?: string
          p_scan_method?: string
          p_scanned_by: string
          p_ticket_id: string
        }
        Returns: {
          already_scanned: boolean
          error_message: string
          scanned_at: string
          scanned_by: string
          success: boolean
        }[]
      }
      sum_active_reservations: {
        Args: { p_ticket_type_id: string }
        Returns: number
      }
      sync_offline_scan: {
        Args: {
          p_device_id?: string
          p_scanned_at: string
          p_scanned_by: string
          p_ticket_id: string
        }
        Returns: {
          conflict_resolved: boolean
          success: boolean
          winner_device: string
          winner_time: string
        }[]
      }
      update_saga_step: {
        Args: {
          p_context_snapshot?: Json
          p_saga_id: string
          p_step_name: string
        }
        Returns: undefined
      }
      update_webhook_idempotency: {
        Args: {
          p_metadata?: Json
          p_record_id: string
          p_response_data: Json
          p_response_status?: number
        }
        Returns: boolean
      }
      verify_vip_pass_signature: {
        Args: {
          p_guest_number?: number
          p_qr_token: string
          p_reservation_id?: string
          p_signature: string
        }
        Returns: Json
      }
    }
    Enums: {
      saga_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "compensating"
        | "compensated"
        | "compensation_failed"
      table_tier: "premium" | "front_row" | "standard"
      vip_reservation_status:
        | "pending"
        | "confirmed"
        | "checked_in"
        | "no_show"
        | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      saga_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "compensating",
        "compensated",
        "compensation_failed",
      ],
      table_tier: ["premium", "front_row", "standard"],
      vip_reservation_status: [
        "pending",
        "confirmed",
        "checked_in",
        "no_show",
        "cancelled",
      ],
    },
  },
} as const
