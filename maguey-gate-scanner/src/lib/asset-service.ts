import { supabase } from '@/integrations/supabase/client';

export interface VenueAsset {
  id: string;
  venue_id: string;
  asset_type: string;
  original_filename: string;
  storage_url: string;
  cdn_url: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export type AssetType = 'logo' | 'logo_square' | 'favicon' | 'email_header' | 'pdf_template' | 'loading_screen' | 'other';

/**
 * Upload an asset to Supabase Storage
 */
export const uploadAsset = async (
  venueId: string,
  file: File,
  assetType: AssetType,
  onProgress?: (progress: number) => void
): Promise<VenueAsset | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${venueId}/${assetType}/${timestamp}.${extension}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('venue-assets')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading asset:', uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('venue-assets')
      .getPublicUrl(filename);

    // Get image dimensions if it's an image
    let width: number | null = null;
    let height: number | null = null;
    if (file.type.startsWith('image/')) {
      const dimensions = await getImageDimensions(file);
      width = dimensions.width;
      height = dimensions.height;
    }

    // Create asset record
    const { data: assetData, error: assetError } = await supabase
      .from('venue_assets')
      .insert({
        venue_id: venueId,
        asset_type: assetType,
        original_filename: file.name,
        storage_url: uploadData.path,
        cdn_url: urlData.publicUrl,
        file_size_bytes: file.size,
        mime_type: file.type,
        width,
        height,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (assetError) {
      console.error('Error creating asset record:', assetError);
      // Try to clean up uploaded file
      await supabase.storage.from('venue-assets').remove([filename]);
      return null;
    }

    return assetData;
  } catch (error) {
    console.error('Error in uploadAsset:', error);
    return null;
  }
};

/**
 * Get image dimensions from a file
 */
const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
};

/**
 * Get assets for a venue
 */
export const getVenueAssets = async (
  venueId: string,
  assetType?: AssetType
): Promise<VenueAsset[]> => {
  try {
    let query = supabase
      .from('venue_assets')
      .select('*')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });

    if (assetType) {
      query = query.eq('asset_type', assetType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching venue assets:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getVenueAssets:', error);
    return [];
  }
};

/**
 * Delete an asset
 */
export const deleteAsset = async (assetId: string): Promise<boolean> => {
  try {
    // Get asset info first
    const { data: asset, error: fetchError } = await supabase
      .from('venue_assets')
      .select('storage_url')
      .eq('id', assetId)
      .single();

    if (fetchError || !asset) {
      console.error('Error fetching asset:', fetchError);
      return false;
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('venue-assets')
      .remove([asset.storage_url]);

    if (storageError) {
      console.error('Error deleting asset from storage:', storageError);
      // Continue to delete DB record anyway
    }

    // Delete database record
    const { error: deleteError } = await supabase
      .from('venue_assets')
      .delete()
      .eq('id', assetId);

    if (deleteError) {
      console.error('Error deleting asset record:', deleteError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteAsset:', error);
    return false;
  }
};

/**
 * Optimize image (client-side resize)
 */
export const optimizeImage = async (
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.9
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
      }

      // Create canvas and resize
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }
          const optimizedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          });
          resolve(optimizedFile);
        },
        file.type,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

/**
 * Validate file before upload
 */
export const validateAssetFile = (
  file: File,
  assetType: AssetType
): { valid: boolean; error?: string } => {
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  // Validate file types based on asset type
  const allowedTypes: Record<AssetType, string[]> = {
    logo: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
    logo_square: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
    favicon: ['image/png', 'image/x-icon', 'image/svg+xml'],
    email_header: ['image/png', 'image/jpeg', 'image/svg+xml'],
    pdf_template: ['application/pdf'],
    loading_screen: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
    other: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'application/pdf'],
  };

  const allowed = allowedTypes[assetType] || allowedTypes.other;
  if (!allowed.includes(file.type)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${allowed.join(', ')}`,
    };
  }

  return { valid: true };
};

