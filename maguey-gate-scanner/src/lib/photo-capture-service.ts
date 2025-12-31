import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import Dexie, { Table } from 'dexie';

// Offline photo queue database
interface QueuedPhoto {
  id?: number;
  ticketId: string;
  photoBlob: Blob;
  thumbnailBlob: Blob;
  metadata: PhotoMetadata;
  userId?: string;
  consent: boolean;
  queuedAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  errorMessage?: string;
}

class PhotoQueueDatabase extends Dexie {
  queuedPhotos!: Table<QueuedPhoto, number>;

  constructor() {
    super('PhotoQueueDatabase');
    this.version(1).stores({
      queuedPhotos: '++id, ticketId, syncStatus, queuedAt, retryCount',
    });
  }
}

const photoDb = new PhotoQueueDatabase();

export interface PhotoMetadata {
  width: number;
  height: number;
  size: number; // bytes
  format: string; // 'image/jpeg', 'image/png', etc.
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
  };
  blur_score?: number; // 0-1, higher = more blur
  device_info?: {
    user_agent?: string;
    device_model?: string;
  };
  timestamp: string;
}

export interface PhotoCaptureResult {
  success: boolean;
  photoUrl?: string;
  thumbnailUrl?: string;
  photoId?: string;
  error?: string;
  metadata?: PhotoMetadata;
}

export interface PhotoQualityCheck {
  isValid: boolean;
  blurScore?: number;
  isTooBlurry: boolean;
  isTooDark: boolean;
  warnings: string[];
}

/**
 * Compress an image file
 * @param file - Image file to compress
 * @param maxWidth - Maximum width (default: 1920)
 * @param maxHeight - Maximum height (default: 1920)
 * @param quality - JPEG quality 0-1 (default: 0.85)
 * @returns Promise<Blob> - Compressed image blob
 */
export const compressImage = async (
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.85
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Generate a thumbnail from an image
 * @param file - Image file to create thumbnail from
 * @param maxWidth - Maximum thumbnail width (default: 300)
 * @param maxHeight - Maximum thumbnail height (default: 300)
 * @param quality - JPEG quality 0-1 (default: 0.7)
 * @returns Promise<Blob> - Thumbnail image blob
 */
export const generateThumbnail = async (
  file: File,
  maxWidth: number = 300,
  maxHeight: number = 300,
  quality: number = 0.7
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate thumbnail dimensions
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to generate thumbnail'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Calculate blur score using Laplacian variance
 * @param imageData - Image data from canvas
 * @returns number - Blur score (0-1, higher = more blur)
 */
const calculateBlurScore = (imageData: ImageData): number => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  let variance = 0;
  let mean = 0;
  let count = 0;

  // Sample pixels for performance (every 4th pixel)
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = (y * width + x) * 4;
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      mean += gray;
      count++;
    }
  }

  mean /= count;

  // Calculate variance
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = (y * width + x) * 4;
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      variance += Math.pow(gray - mean, 2);
    }
  }

  variance /= count;

  // Normalize blur score (0-1, where 1 is very blurry)
  // Lower variance = more blur
  const normalizedScore = Math.max(0, Math.min(1, 1 - variance / 10000));
  return normalizedScore;
};

/**
 * Check photo quality (blur, lighting, etc.)
 * @param file - Image file to check
 * @returns Promise<PhotoQualityCheck> - Quality check results
 */
export const checkPhotoQuality = async (file: File): Promise<PhotoQualityCheck> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Calculate blur score
        const blurScore = calculateBlurScore(imageData);

        // Check brightness (average luminance)
        const data = imageData.data;
        let totalBrightness = 0;
        let pixelCount = 0;

        for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          totalBrightness += luminance;
          pixelCount++;
        }

        const avgBrightness = totalBrightness / pixelCount;
        const isTooDark = avgBrightness < 50; // Threshold for dark images
        const isTooBlurry = blurScore > 0.5; // Threshold for blurry images

        const warnings: string[] = [];
        if (isTooBlurry) {
          warnings.push('Photo appears blurry');
        }
        if (isTooDark) {
          warnings.push('Photo appears too dark');
        }

        resolve({
          isValid: !isTooBlurry && !isTooDark,
          blurScore,
          isTooBlurry,
          isTooDark,
          warnings,
        });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Get current location if available
 * @returns Promise<{latitude: number, longitude: number, accuracy: number} | null>
 */
const getCurrentLocation = (): Promise<{ latitude: number; longitude: number; accuracy: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => resolve(null),
      { timeout: 3000, maximumAge: 60000 }
    );
  });
};

/**
 * Queue photo for offline upload
 */
const queuePhotoForUpload = async (
  file: File,
  ticketId: string,
  userId?: string,
  consent: boolean = false
): Promise<PhotoCaptureResult> => {
  try {
    // Compress and generate thumbnail
    const compressedFile = await compressImage(file);
    const thumbnail = await generateThumbnail(file);
    const qualityCheck = await checkPhotoQuality(file);
    const location = await getCurrentLocation();

    // Get image dimensions
    const img = new Image();
    const imageDimensions = await new Promise<{ width: number; height: number }>((resolve) => {
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = URL.createObjectURL(file);
    });

    const metadata: PhotoMetadata = {
      width: imageDimensions.width,
      height: imageDimensions.height,
      size: compressedFile.size,
      format: file.type || 'image/jpeg',
      location: location || undefined,
      blur_score: qualityCheck.blurScore,
      device_info: {
        user_agent: navigator.userAgent,
      },
      timestamp: new Date().toISOString(),
    };

    // Queue photo
    const queuedPhoto: Omit<QueuedPhoto, 'id'> = {
      ticketId,
      photoBlob: compressedFile,
      thumbnailBlob: thumbnail,
      metadata,
      userId,
      consent,
      queuedAt: new Date().toISOString(),
      syncStatus: 'pending',
      retryCount: 0,
    };

    await photoDb.queuedPhotos.add(queuedPhoto as QueuedPhoto);

    return {
      success: true,
      error: 'Photo queued for upload when online',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to queue photo',
    };
  }
};

/**
 * Sync queued photos
 */
export const syncQueuedPhotos = async (): Promise<{
  success: number;
  failed: number;
  total: number;
}> => {
  if (!isSupabaseConfigured() || !navigator.onLine) {
    return { success: 0, failed: 0, total: 0 };
  }

  const pendingPhotos = await photoDb.queuedPhotos
    .where('syncStatus')
    .anyOf(['pending', 'failed'])
    .toArray();

  let success = 0;
  let failed = 0;

  for (const queuedPhoto of pendingPhotos) {
    try {
      await photoDb.queuedPhotos.update(queuedPhoto.id!, { syncStatus: 'syncing' });

      const timestamp = Date.now();
      const photoPath = `ticket-photos/${queuedPhoto.ticketId}/${timestamp}_photo.jpg`;
      const thumbnailPath = `ticket-photos/${queuedPhoto.ticketId}/${timestamp}_thumbnail.jpg`;

      // Upload photo
      const { error: photoError } = await supabase.storage
        .from('ticket-photos')
        .upload(photoPath, queuedPhoto.photoBlob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (photoError) throw photoError;

      // Upload thumbnail
      const { error: thumbnailError } = await supabase.storage
        .from('ticket-photos')
        .upload(thumbnailPath, queuedPhoto.thumbnailBlob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (thumbnailError) console.warn('Thumbnail upload failed:', thumbnailError);

      // Get public URLs
      const { data: photoUrlData } = supabase.storage
        .from('ticket-photos')
        .getPublicUrl(photoPath);

      const { data: thumbnailUrlData } = supabase.storage
        .from('ticket-photos')
        .getPublicUrl(thumbnailPath);

      const photoUrl = photoUrlData.publicUrl;
      const thumbnailUrl = thumbnailUrlData.publicUrl;

      // Save photo record
      const { error: dbError } = await supabase
        .from('ticket_photos')
        .insert({
          ticket_id: queuedPhoto.ticketId,
          photo_url: photoUrl,
          thumbnail_url: thumbnailUrl,
          photo_metadata: queuedPhoto.metadata,
          captured_by: queuedPhoto.userId || null,
        });

      if (dbError) throw dbError;

      // Update ticket
      await supabase
        .from('tickets')
        .update({
          photo_url: photoUrl,
          photo_captured_at: queuedPhoto.queuedAt,
          photo_captured_by: queuedPhoto.userId || null,
          photo_consent: queuedPhoto.consent,
        })
        .eq('id', queuedPhoto.ticketId);

      await photoDb.queuedPhotos.update(queuedPhoto.id!, { syncStatus: 'synced' });
      success++;
    } catch (error: any) {
      const newRetryCount = queuedPhoto.retryCount + 1;
      await photoDb.queuedPhotos.update(queuedPhoto.id!, {
        syncStatus: newRetryCount >= 10 ? 'failed' : 'failed',
        retryCount: newRetryCount,
        errorMessage: error.message,
      });
      failed++;
    }
  }

  return { success, failed, total: pendingPhotos.length };
};

/**
 * Upload photo to Supabase Storage
 * @param file - Image file to upload
 * @param ticketId - Ticket ID
 * @param userId - User ID who captured the photo
 * @param consent - Whether attendee consented
 * @returns Promise<PhotoCaptureResult> - Upload result
 */
export const uploadPhoto = async (
  file: File,
  ticketId: string,
  userId?: string,
  consent: boolean = false
): Promise<PhotoCaptureResult> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase not configured',
    };
  }

  // If offline, queue for later
  if (!navigator.onLine) {
    return await queuePhotoForUpload(file, ticketId, userId, consent);
  }

  try {
    // Compress image
    const compressedFile = await compressImage(file);
    const thumbnail = await generateThumbnail(file);

    // Check quality
    const qualityCheck = await checkPhotoQuality(file);
    if (!qualityCheck.isValid) {
      // Still upload but warn user
      console.warn('Photo quality issues:', qualityCheck.warnings);
    }

    // Get location if available
    const location = await getCurrentLocation();

    // Generate file paths
    const timestamp = Date.now();
    const photoPath = `ticket-photos/${ticketId}/${timestamp}_photo.jpg`;
    const thumbnailPath = `ticket-photos/${ticketId}/${timestamp}_thumbnail.jpg`;

    // Upload photo
    const { data: photoData, error: photoError } = await supabase.storage
      .from('ticket-photos')
      .upload(photoPath, compressedFile, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (photoError) {
      return {
        success: false,
        error: `Failed to upload photo: ${photoError.message}`,
      };
    }

    // Upload thumbnail
    const { data: thumbnailData, error: thumbnailError } = await supabase.storage
      .from('ticket-photos')
      .upload(thumbnailPath, thumbnail, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (thumbnailError) {
      console.warn('Failed to upload thumbnail:', thumbnailError);
    }

    // Get public URLs
    const { data: photoUrlData } = supabase.storage
      .from('ticket-photos')
      .getPublicUrl(photoPath);

    const { data: thumbnailUrlData } = supabase.storage
      .from('ticket-photos')
      .getPublicUrl(thumbnailPath);

    const photoUrl = photoUrlData.publicUrl;
    const thumbnailUrl = thumbnailUrlData.publicUrl;

    // Get image dimensions
    const img = new Image();
    const imageDimensions = await new Promise<{ width: number; height: number }>((resolve) => {
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = URL.createObjectURL(file);
    });

    // Create metadata
    const metadata: PhotoMetadata = {
      width: imageDimensions.width,
      height: imageDimensions.height,
      size: compressedFile.size,
      format: file.type || 'image/jpeg',
      location: location || undefined,
      blur_score: qualityCheck.blurScore,
      device_info: {
        user_agent: navigator.userAgent,
      },
      timestamp: new Date().toISOString(),
    };

    // Save photo record to database
    const { data: photoRecord, error: dbError } = await supabase
      .from('ticket_photos')
      .insert({
        ticket_id: ticketId,
        photo_url: photoUrl,
        thumbnail_url: thumbnailUrl,
        photo_metadata: metadata,
        captured_by: userId || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Failed to save photo record:', dbError);
      // Photo uploaded but record failed - still return success
    }

    // Update ticket with primary photo URL
    const { error: ticketUpdateError } = await supabase
      .from('tickets')
      .update({
        photo_url: photoUrl,
        photo_captured_at: new Date().toISOString(),
        photo_captured_by: userId || null,
        photo_consent: consent,
      })
      .eq('id', ticketId);

    if (ticketUpdateError) {
      console.error('Failed to update ticket with photo:', ticketUpdateError);
    }

    return {
      success: true,
      photoUrl,
      thumbnailUrl,
      photoId: photoRecord?.id,
      metadata,
    };
  } catch (error: any) {
    console.error('Photo upload error:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload photo',
    };
  }
};

/**
 * Get photos for a ticket
 * @param ticketId - Ticket ID
 * @returns Promise<Array> - Array of photo records
 */
export const getTicketPhotos = async (ticketId: string) => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { data, error } = await supabase
    .from('ticket_photos')
    .select('*')
    .eq('ticket_id', ticketId)
    .eq('is_deleted', false)
    .order('captured_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch ticket photos:', error);
    return [];
  }

  return data || [];
};

/**
 * Delete a photo (soft delete)
 * @param photoId - Photo ID
 * @returns Promise<boolean> - Success status
 */
export const deletePhoto = async (photoId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const { error } = await supabase
    .from('ticket_photos')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', photoId);

  if (error) {
    console.error('Failed to delete photo:', error);
    return false;
  }

  return true;
};

/**
 * Compare two photos for similarity (basic implementation)
 * @param photoUrl1 - First photo URL
 * @param photoUrl2 - Second photo URL
 * @returns Promise<number> - Similarity score (0-1, higher = more similar)
 */
export const comparePhotos = async (
  photoUrl1: string,
  photoUrl2: string
): Promise<number> => {
  // Basic implementation - in production, use a proper face recognition service
  // This is a placeholder that returns a random similarity score
  // For real implementation, use services like AWS Rekognition, Google Vision API, etc.
  
  return new Promise((resolve) => {
    const img1 = new Image();
    const img2 = new Image();
    
    img1.onload = () => {
      img2.onload = () => {
        // Simple comparison based on dimensions and basic features
        // This is a placeholder - implement proper face matching in production
        const widthDiff = Math.abs(img1.width - img2.width) / Math.max(img1.width, img2.width);
        const heightDiff = Math.abs(img1.height - img2.height) / Math.max(img1.height, img2.height);
        
        // Basic similarity (not real face matching)
        const similarity = 1 - (widthDiff + heightDiff) / 2;
        resolve(Math.max(0, Math.min(1, similarity)));
      };
      img2.src = photoUrl2;
    };
    img1.src = photoUrl1;
  });
};

