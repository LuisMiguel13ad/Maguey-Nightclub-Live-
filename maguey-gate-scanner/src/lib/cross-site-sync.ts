/**
 * Cross-Site Sync Service
 * Handles syncing data across all three websites
 */

import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export type SyncType = "event" | "branding" | "content" | "settings";

export interface SyncResult {
  success: boolean;
  syncedSites: string[];
  failedSites: string[];
  errors?: string[];
}

/**
 * Sync an event update across all sites
 */
export async function syncEvent(eventId: string): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      syncedSites: [],
      failedSites: ["main", "purchase", "scanner"],
      errors: ["Supabase not configured"],
    };
  }

  try {
    // Log sync operation
    const { data: user } = await supabase.auth.getUser();
    
    const { data: syncLog, error: logError } = await supabase
      .from("cross_site_sync_log")
      .insert({
        sync_type: "event",
        source_site: "scanner",
        target_sites: ["main", "purchase"],
        status: "pending",
        synced_by: user?.user?.id || null,
      })
      .select()
      .single();

    if (logError) throw logError;

    // Events are automatically synced via Supabase real-time subscriptions
    // This function mainly logs the sync operation
    const syncedSites = ["main", "purchase"]; // Scanner is source

    // Update sync log as successful
    await supabase
      .from("cross_site_sync_log")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        details: {
          event_id: eventId,
          synced_sites: syncedSites,
        },
      })
      .eq("id", syncLog.id);

    return {
      success: true,
      syncedSites,
      failedSites: [],
    };
  } catch (error: any) {
    return {
      success: false,
      syncedSites: [],
      failedSites: ["main", "purchase"],
      errors: [error.message],
    };
  }
}

/**
 * Sync branding changes across selected sites
 */
export async function syncBranding(
  brandingConfig: any,
  targetSites: string[],
  autoSync: boolean = false
): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      syncedSites: [],
      failedSites: targetSites,
      errors: ["Supabase not configured"],
    };
  }

  try {
    const { data: user } = await supabase.auth.getUser();

    // Log sync operation
    const { data: syncLog, error: logError } = await supabase
      .from("cross_site_sync_log")
      .insert({
        sync_type: "branding",
        source_site: "scanner",
        target_sites: targetSites,
        status: "pending",
        synced_by: user?.user?.id || null,
      })
      .select()
      .single();

    if (logError) throw logError;

    const syncedSites: string[] = [];
    const failedSites: string[] = [];
    const errors: string[] = [];

    // Update branding for each target site
    for (const siteType of targetSites) {
      try {
        const { error: updateError } = await supabase
          .from("branding_sync")
          .update({
            branding_config: brandingConfig,
            last_synced_at: new Date().toISOString(),
            synced_by: user?.user?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("site_type", siteType);

        if (updateError) {
          failedSites.push(siteType);
          errors.push(`${siteType}: ${updateError.message}`);
        } else {
          syncedSites.push(siteType);
        }
      } catch (error: any) {
        failedSites.push(siteType);
        errors.push(`${siteType}: ${error.message}`);
      }
    }

    // Update sync log
    const status = failedSites.length === 0 ? "success" : failedSites.length < targetSites.length ? "partial" : "failed";
    
    await supabase
      .from("cross_site_sync_log")
      .update({
        status,
        completed_at: new Date().toISOString(),
        details: {
          branding_config: brandingConfig,
          synced_sites: syncedSites,
          failed_sites: failedSites,
          errors,
        },
      })
      .eq("id", syncLog.id);

    return {
      success: failedSites.length === 0,
      syncedSites,
      failedSites,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    return {
      success: false,
      syncedSites: [],
      failedSites: targetSites,
      errors: [error.message],
    };
  }
}

/**
 * Sync content changes across sites
 */
export async function syncContent(
  contentId: string,
  targetSites: string[]
): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      syncedSites: [],
      failedSites: targetSites,
      errors: ["Supabase not configured"],
    };
  }

  try {
    const { data: user } = await supabase.auth.getUser();

    // Get content to sync
    const { data: content, error: contentError } = await supabase
      .from("site_content")
      .select("*")
      .eq("id", contentId)
      .single();

    if (contentError) throw contentError;

    // Log sync operation
    const { data: syncLog, error: logError } = await supabase
      .from("cross_site_sync_log")
      .insert({
        sync_type: "content",
        source_site: content.site_type,
        target_sites: targetSites,
        status: "pending",
        synced_by: user?.user?.id || null,
      })
      .select()
      .single();

    if (logError) throw logError;

    const syncedSites: string[] = [];
    const failedSites: string[] = [];
    const errors: string[] = [];

    // Copy content to target sites
    for (const siteType of targetSites) {
      try {
        const { error: insertError } = await supabase
          .from("site_content")
          .upsert({
            site_type: siteType,
            content_type: content.content_type,
            content_key: content.content_key,
            title: content.title,
            content: content.content,
            metadata: content.metadata,
            is_published: content.is_published,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "site_type,content_type,content_key",
          });

        if (insertError) {
          failedSites.push(siteType);
          errors.push(`${siteType}: ${insertError.message}`);
        } else {
          syncedSites.push(siteType);
        }
      } catch (error: any) {
        failedSites.push(siteType);
        errors.push(`${siteType}: ${error.message}`);
      }
    }

    // Update sync log
    const status = failedSites.length === 0 ? "success" : failedSites.length < targetSites.length ? "partial" : "failed";
    
    await supabase
      .from("cross_site_sync_log")
      .update({
        status,
        completed_at: new Date().toISOString(),
        details: {
          content_id: contentId,
          synced_sites: syncedSites,
          failed_sites: failedSites,
          errors,
        },
      })
      .eq("id", syncLog.id);

    return {
      success: failedSites.length === 0,
      syncedSites,
      failedSites,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    return {
      success: false,
      syncedSites: [],
      failedSites: targetSites,
      errors: [error.message],
    };
  }
}

/**
 * Get sync history
 */
export async function getSyncHistory(limit: number = 50) {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("cross_site_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching sync history:", error);
    return [];
  }
}

