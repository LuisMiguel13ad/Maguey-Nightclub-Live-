/**
 * Service for uploading event images to Supabase Storage
 */

import { supabase } from "@/integrations/supabase/client";

export interface ImageUploadResult {
  url: string;
  path: string;
  error?: string;
}

/**
 * Upload an event image to Supabase Storage
 * @param file - The image file to upload
 * @param eventId - Optional event ID for organizing files
 * @returns Public URL of uploaded image
 */
export async function uploadEventImage(
  file: File,
  eventId?: string
): Promise<ImageUploadResult> {
  try {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return {
        url: '',
        path: '',
        error: 'Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.',
      };
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        url: '',
        path: '',
        error: 'File size exceeds 5MB limit. Please compress your image.',
      };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const extension = file.name.split('.').pop();
    const fileName = eventId
      ? `events/${eventId}/${timestamp}-${randomStr}.${extension}`
      : `events/${timestamp}-${randomStr}.${extension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('event-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading image:', error);
      return {
        url: '',
        path: '',
        error: error.message || 'Failed to upload image',
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('event-images')
      .getPublicUrl(fileName);

    return {
      url: urlData.publicUrl,
      path: fileName,
    };
  } catch (error: any) {
    console.error('Error uploading event image:', error);
    return {
      url: '',
      path: '',
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Delete an event image from Supabase Storage
 */
export async function deleteEventImage(imagePath: string): Promise<boolean> {
  try {
    // Extract path from URL if full URL is provided
    const path = imagePath.includes('/storage/v1/object/public/event-images/')
      ? imagePath.split('/storage/v1/object/public/event-images/')[1]
      : imagePath;

    const { error } = await supabase.storage
      .from('event-images')
      .remove([path]);

    if (error) {
      console.error('Error deleting image:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting event image:', error);
    return false;
  }
}

/**
 * Validate image file before upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.',
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 5MB limit. Please compress your image.',
    };
  }

  return { valid: true };
}

