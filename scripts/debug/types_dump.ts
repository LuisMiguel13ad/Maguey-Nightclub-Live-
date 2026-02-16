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

                <truncated 62365 bytes >
                    n    : never

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
