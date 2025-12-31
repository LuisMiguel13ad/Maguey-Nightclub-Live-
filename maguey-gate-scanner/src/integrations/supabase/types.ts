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
      scan_logs: {
        Row: {
          id: string
          metadata: Json | null
          scan_result: string
          scanned_at: string
          scanned_by: string | null
          ticket_id: string | null
          scan_duration_ms: number | null
          scan_method: string | null
          override_used: boolean | null
          override_reason: string | null
        }
        Insert: {
          id?: string
          metadata?: Json | null
          scan_result: string
          scanned_at?: string
          scanned_by?: string | null
          ticket_id?: string | null
          scan_duration_ms?: number | null
          scan_method?: string | null
          override_used?: boolean | null
          override_reason?: string | null
        }
        Update: {
          id?: string
          metadata?: Json | null
          scan_result?: string
          scanned_at?: string
          scanned_by?: string | null
          ticket_id?: string | null
          scan_duration_ms?: number | null
          scan_method?: string | null
          override_used?: boolean | null
          override_reason?: string | null
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
      tickets: {
        Row: {
          created_at: string
          event_name: string
          guest_email: string | null
          guest_name: string | null
          id: string
          is_used: boolean
          issued_at: string | null
          metadata: Json | null
          nfc_signature: string | null
          nfc_tag_id: string | null
          order_id: string | null
          qr_signature: string | null
          qr_token: string | null
          purchase_date: string
          scanned_at: string | null
          scanned_by: string | null
          status: string | null
          ticket_id: string
          ticket_type: string
          tier: string | null
          updated_at: string | null
          photo_url: string | null
          photo_captured_at: string | null
          photo_captured_by: string | null
          photo_consent: boolean | null
        }
        Insert: {
          created_at?: string
          event_name: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          is_used?: boolean
          issued_at?: string | null
          metadata?: Json | null
          nfc_signature?: string | null
          nfc_tag_id?: string | null
          order_id?: string | null
          qr_signature?: string | null
          qr_token?: string | null
          purchase_date?: string
          scanned_at?: string | null
          scanned_by?: string | null
          status?: string | null
          ticket_id: string
          ticket_type: string
          tier?: string | null
          updated_at?: string | null
          photo_url?: string | null
          photo_captured_at?: string | null
          photo_captured_by?: string | null
          photo_consent?: boolean | null
        }
        Update: {
          created_at?: string
          event_name?: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          is_used?: boolean
          issued_at?: string | null
          metadata?: Json | null
          nfc_signature?: string | null
          nfc_tag_id?: string | null
          order_id?: string | null
          qr_signature?: string | null
          qr_token?: string | null
          purchase_date?: string
          scanned_at?: string | null
          scanned_by?: string | null
          status?: string | null
          ticket_id?: string
          ticket_type?: string
          tier?: string | null
          updated_at?: string | null
          photo_url?: string | null
          photo_captured_at?: string | null
          photo_captured_by?: string | null
          photo_consent?: boolean | null
        }
        Relationships: []
      }
      ticket_photos: {
        Row: {
          id: string
          ticket_id: string
          photo_url: string
          thumbnail_url: string | null
          photo_metadata: Json | null
          captured_by: string | null
          captured_at: string
          is_deleted: boolean
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          photo_url: string
          thumbnail_url?: string | null
          photo_metadata?: Json | null
          captured_by?: string | null
          captured_at?: string
          is_deleted?: boolean
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          photo_url?: string
          thumbnail_url?: string | null
          photo_metadata?: Json | null
          captured_by?: string | null
          captured_at?: string
          is_deleted?: boolean
          deleted_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_photos_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_tiers: {
        Row: {
          id: string
          name: string
          color: string
          sound_profile: string
          perks_description: string | null
          priority_level: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          color?: string
          sound_profile?: string
          perks_description?: string | null
          priority_level?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          sound_profile?: string
          perks_description?: string | null
          priority_level?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      emergency_override_logs: {
        Row: {
          id: string
          ticket_id: string | null
          user_id: string | null
          override_type: string
          reason: string
          notes: string | null
          scan_log_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id?: string | null
          user_id?: string | null
          override_type: string
          reason: string
          notes?: string | null
          scan_log_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string | null
          user_id?: string | null
          override_type?: string
          reason?: string
          notes?: string | null
          scan_log_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      scanner_devices: {
        Row: {
          id: string
          device_id: string
          device_name: string | null
          device_model: string | null
          os_version: string | null
          app_version: string | null
          user_id: string | null
          last_seen: string
          battery_level: number | null
          is_charging: boolean
          is_online: boolean
          storage_used_mb: number | null
          storage_total_mb: number | null
          network_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          device_id: string
          device_name?: string | null
          device_model?: string | null
          os_version?: string | null
          app_version?: string | null
          user_id?: string | null
          last_seen?: string
          battery_level?: number | null
          is_charging?: boolean
          is_online?: boolean
          storage_used_mb?: number | null
          storage_total_mb?: number | null
          network_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          device_id?: string
          device_name?: string | null
          device_model?: string | null
          os_version?: string | null
          app_version?: string | null
          user_id?: string | null
          last_seen?: string
          battery_level?: number | null
          is_charging?: boolean
          is_online?: boolean
          storage_used_mb?: number | null
          storage_total_mb?: number | null
          network_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scanner_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      device_battery_logs: {
        Row: {
          id: string
          device_id: string
          battery_level: number
          is_charging: boolean
          estimated_time_remaining_minutes: number | null
          timestamp: string
        }
        Insert: {
          id?: string
          device_id: string
          battery_level: number
          is_charging?: boolean
          estimated_time_remaining_minutes?: number | null
          timestamp?: string
        }
        Update: {
          id?: string
          device_id?: string
          battery_level?: number
          is_charging?: boolean
          estimated_time_remaining_minutes?: number | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_battery_logs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "scanner_devices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_tier_info: {
        Args: {
          tier_name: string
        }
        Returns: {
          id: string
          name: string
          color: string
          sound_profile: string
          perks_description: string | null
          priority_level: number
        }[]
      }
      get_override_stats: {
        Args: {
          start_date?: string
          end_date?: string
        }
        Returns: {
          total_overrides: number
          capacity_overrides: number
          refund_overrides: number
          transfer_overrides: number
          id_verification_overrides: number
          duplicate_overrides: number
          unique_users: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
