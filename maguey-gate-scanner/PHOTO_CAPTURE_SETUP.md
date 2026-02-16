# Photo Capture Feature Setup Guide

This guide will help you set up the photo capture feature for fraud prevention and verification.

## Prerequisites

1. Supabase project configured
2. Database migrations applied
3. Supabase Storage bucket created

## Database Setup

Run the migration file:
```bash
supabase migration up
```

Or apply manually:
```sql
-- See: supabase/migrations/20250123000000_add_photo_capture.sql
```

## Storage Bucket Setup

1. **Create Storage Bucket:**
   - Go to Supabase Dashboard → Storage
   - Create a new bucket named `ticket-photos`
   - Set it to **Public** (or configure RLS policies)
   - Enable file size limits (recommended: 10MB max)

2. **Storage Policies (if using RLS):**
   ```sql
   -- Allow authenticated users to upload photos
   CREATE POLICY "Authenticated users can upload photos"
   ON storage.objects
   FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'ticket-photos');

   -- Allow authenticated users to read photos
   CREATE POLICY "Authenticated users can read photos"
   ON storage.objects
   FOR SELECT
   TO authenticated
   USING (bucket_id = 'ticket-photos');
   ```

## Features Implemented

### ✅ Core Features

1. **Photo Capture on Ticket Scan**
   - Camera integration with front/back camera switching
   - Photo preview with retake option
   - Quality validation (blur detection, lighting check)
   - Photo compression and thumbnail generation

2. **Photo Storage**
   - Secure storage in Supabase Storage
   - Automatic compression (max 1920x1920)
   - Thumbnail generation (300x300)
   - Metadata capture (dimensions, size, location, blur score)

3. **Photo Management**
   - Photo gallery view
   - Photo deletion (soft delete)
   - Photo download
   - Multiple photos per ticket support

4. **Privacy & Compliance**
   - Photo consent checkbox
   - Consent tracking in database
   - Photo deletion on request
   - Secure access (RLS policies)

5. **Offline Support**
   - Photos queued for upload when offline
   - Automatic sync when online
   - Retry logic with exponential backoff

6. **Photo Verification**
   - Basic photo comparison (placeholder)
   - Quality scoring
   - Duplicate detection framework

## Usage

### Capturing Photos

1. Scan a ticket
2. When ticket is valid, click "Capture Photo" button
3. Grant camera permissions if prompted
4. Take photo using camera interface
5. Review photo quality warnings (if any)
6. Check consent checkbox (if required)
7. Click "Accept Photo"

### Viewing Photos

- Photos appear as thumbnails in the ticket result screen
- Click "View Gallery" to see all photos for a ticket
- Click on a photo to view full size and metadata

### Photo Requirements

Photos are **required** for:
- VIP tickets
- Premium tickets
- ID verification scenarios

Photos are **optional** for:
- General admission tickets

## Configuration

### Photo Quality Settings

Edit `src/lib/photo-capture-service.ts`:

```typescript
// Compression settings
const maxWidth = 1920;  // Max photo width
const maxHeight = 1920; // Max photo height
const quality = 0.85;   // JPEG quality (0-1)

// Thumbnail settings
const thumbnailMaxWidth = 300;
const thumbnailMaxHeight = 300;
const thumbnailQuality = 0.7;

// Quality thresholds
const blurThreshold = 0.5;  // Blur score threshold
const brightnessThreshold = 50; // Minimum brightness
```

### Privacy Settings

Edit `src/components/PhotoCaptureModal.tsx`:

```typescript
requireConsent={true}  // Require consent checkbox
requirePhoto={false}   // Require photo before closing
```

## API Reference

### Photo Capture Service

```typescript
// Upload photo
uploadPhoto(file: File, ticketId: string, userId?: string, consent?: boolean)

// Get ticket photos
getTicketPhotos(ticketId: string)

// Delete photo
deletePhoto(photoId: string)

// Compare photos
comparePhotos(photoUrl1: string, photoUrl2: string)

// Sync queued photos (offline)
syncQueuedPhotos()
```

## Integration with Face Recognition

The current photo comparison is a placeholder. For production use, integrate with:

- **AWS Rekognition** - Face comparison API
- **Google Vision API** - Face detection and comparison
- **Azure Face API** - Face recognition service
- **Face-api.js** - Client-side face detection (less accurate)

Example integration:

```typescript
// In photo-capture-service.ts
export const comparePhotos = async (
  photoUrl1: string,
  photoUrl2: string
): Promise<number> => {
  // Call your face recognition service
  const response = await fetch('/api/compare-faces', {
    method: 'POST',
    body: JSON.stringify({ photo1: photoUrl1, photo2: photoUrl2 }),
  });
  const { similarity } = await response.json();
  return similarity;
};
```

## Troubleshooting

### Camera Not Working

1. Check browser permissions
2. Ensure HTTPS (required for camera access)
3. Check browser console for errors

### Photos Not Uploading

1. Check Supabase Storage bucket exists
2. Verify storage policies
3. Check network connection
4. Review browser console for errors

### Offline Queue Not Syncing

1. Check `syncQueuedPhotos()` is called when online
2. Verify IndexedDB is enabled
3. Check browser console for sync errors

## Security Considerations

1. **Storage Access**: Use RLS policies to restrict photo access
2. **Consent**: Always track consent in database
3. **Deletion**: Implement soft delete for audit trail
4. **Retention**: Set up automatic deletion after retention period
5. **Face Recognition**: Use secure API endpoints, never expose API keys

## Future Enhancements

- [ ] Face blur option for privacy
- [ ] Automatic face detection
- [ ] Photo export for security review
- [ ] Batch photo operations
- [ ] Photo search by attendee name
- [ ] Advanced duplicate detection
- [ ] Photo retention policies (30/60/90 days)
- [ ] GDPR compliance tools

