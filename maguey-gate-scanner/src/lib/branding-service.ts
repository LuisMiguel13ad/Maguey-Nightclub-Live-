import { supabase } from '@/integrations/supabase/client';

export interface VenueBranding {
  id: string;
  venue_id: string;
  logo_url: string | null;
  logo_square_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  custom_css: string | null;
  theme_preset: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  name: string;
  slug: string | null;
  subdomain: string | null;
  custom_domain: string | null;
  organization_id: string | null;
  is_active: boolean;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BrandingTemplate {
  id: string;
  name: string;
  description: string | null;
  preview_image_url: string | null;
  configuration: Record<string, any>;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
}

export interface BrandingConfig {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  custom_css?: string;
  theme_preset?: string;
  logo_url?: string;
  logo_square_url?: string;
  favicon_url?: string;
}

/**
 * Get branding for a specific venue
 */
export const getVenueBranding = async (venueId: string): Promise<VenueBranding | null> => {
  try {
    const { data, error } = await supabase
      .from('venue_branding')
      .select('*')
      .eq('venue_id', venueId)
      .maybeSingle();

    if (error) {
      // Check if table doesn't exist (common error code)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('venue_branding table does not exist, returning null');
        return null;
      }
      console.error('Error fetching venue branding:', error);
      return null;
    }

    return data;
  } catch (error) {
    // Handle table not found gracefully
    if (error instanceof Error && (error.message.includes('does not exist') || error.message.includes('relation'))) {
      console.warn('venue_branding table does not exist, returning null');
      return null;
    }
    console.error('Error in getVenueBranding:', error);
    return null;
  }
};

/**
 * Get branding for current venue (defaults to default venue)
 */
export const getCurrentVenueBranding = async (): Promise<VenueBranding | null> => {
  try {
    // First try to get default venue
    const { data: defaultVenue } = await supabase
      .from('venues')
      .select('id')
      .eq('slug', 'default')
      .single();

    const venueId = defaultVenue?.id || '00000000-0000-0000-0000-000000000001';
    return await getVenueBranding(venueId);
  } catch (error) {
    console.error('Error in getCurrentVenueBranding:', error);
    return null;
  }
};

/**
 * Update or create branding for a venue
 */
export const upsertVenueBranding = async (
  venueId: string,
  branding: Partial<BrandingConfig>
): Promise<VenueBranding | null> => {
  try {
    const { data, error } = await supabase
      .from('venue_branding')
      .upsert({
        venue_id: venueId,
        ...branding,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'venue_id',
      })
      .select()
      .maybeSingle();

    if (error) {
      // Check if table doesn't exist (common error code)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('venue_branding table does not exist, returning null');
        return null;
      }
      console.error('Error upserting venue branding:', error);
      return null;
    }

    return data;
  } catch (error) {
    // Handle table not found gracefully
    if (error instanceof Error && (error.message.includes('does not exist') || error.message.includes('relation'))) {
      console.warn('venue_branding table does not exist, returning null');
      return null;
    }
    console.error('Error in upsertVenueBranding:', error);
    return null;
  }
};

/**
 * Get all venues
 */
export const getVenues = async (): Promise<Venue[]> => {
  try {
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching venues:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getVenues:', error);
    return [];
  }
};

/**
 * Get current venue (defaults to default venue)
 */
export const getCurrentVenue = async (): Promise<Venue | null> => {
  try {
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .eq('slug', 'default')
      .single();

    if (error) {
      console.error('Error fetching current venue:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getCurrentVenue:', error);
    return null;
  }
};

/**
 * Create a new venue
 */
export const createVenue = async (venue: Partial<Venue>): Promise<Venue | null> => {
  try {
    const { data, error } = await supabase
      .from('venues')
      .insert(venue)
      .select()
      .single();

    if (error) {
      console.error('Error creating venue:', error);
      return null;
    }

    // Create default branding for new venue
    await upsertVenueBranding(data.id, {
      primary_color: '#8B5CF6',
      secondary_color: '#EC4899',
      accent_color: '#10B981',
      font_family: 'Inter',
      theme_preset: 'default',
    });

    return data;
  } catch (error) {
    console.error('Error in createVenue:', error);
    return null;
  }
};

/**
 * Get public branding templates
 */
export const getPublicTemplates = async (): Promise<BrandingTemplate[]> => {
  try {
    const { data, error } = await supabase
      .from('branding_templates')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching public templates:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPublicTemplates:', error);
    return [];
  }
};

/**
 * Get user's templates
 */
export const getUserTemplates = async (userId: string): Promise<BrandingTemplate[]> => {
  try {
    const { data, error } = await supabase
      .from('branding_templates')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user templates:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserTemplates:', error);
    return [];
  }
};

/**
 * Create a branding template
 */
export const createBrandingTemplate = async (
  template: Omit<BrandingTemplate, 'id' | 'created_at'>
): Promise<BrandingTemplate | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    const { data, error } = await supabase
      .from('branding_templates')
      .insert({
        ...template,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createBrandingTemplate:', error);
    return null;
  }
};

/**
 * Export branding configuration as JSON
 */
export const exportBrandingConfig = async (venueId: string): Promise<string | null> => {
  try {
    const branding = await getVenueBranding(venueId);
    if (!branding) return null;

    const config = {
      primary_color: branding.primary_color,
      secondary_color: branding.secondary_color,
      accent_color: branding.accent_color,
      font_family: branding.font_family,
      custom_css: branding.custom_css,
      theme_preset: branding.theme_preset,
      logo_url: branding.logo_url,
      logo_square_url: branding.logo_square_url,
      favicon_url: branding.favicon_url,
      settings: branding.settings,
    };

    return JSON.stringify(config, null, 2);
  } catch (error) {
    console.error('Error in exportBrandingConfig:', error);
    return null;
  }
};

/**
 * Import branding configuration from JSON
 */
export const importBrandingConfig = async (
  venueId: string,
  configJson: string
): Promise<VenueBranding | null> => {
  try {
    const config = JSON.parse(configJson) as BrandingConfig;
    return await upsertVenueBranding(venueId, config);
  } catch (error) {
    console.error('Error in importBrandingConfig:', error);
    return null;
  }
};

/**
 * Clone branding from one venue to another
 */
export const cloneBranding = async (
  sourceVenueId: string,
  targetVenueId: string
): Promise<VenueBranding | null> => {
  try {
    const sourceBranding = await getVenueBranding(sourceVenueId);
    if (!sourceBranding) {
      console.error('Source branding not found');
      return null;
    }

    return await upsertVenueBranding(targetVenueId, {
      primary_color: sourceBranding.primary_color,
      secondary_color: sourceBranding.secondary_color,
      accent_color: sourceBranding.accent_color,
      font_family: sourceBranding.font_family,
      custom_css: sourceBranding.custom_css,
      theme_preset: sourceBranding.theme_preset,
      logo_url: sourceBranding.logo_url,
      logo_square_url: sourceBranding.logo_square_url,
      favicon_url: sourceBranding.favicon_url,
    });
  } catch (error) {
    console.error('Error in cloneBranding:', error);
    return null;
  }
};

