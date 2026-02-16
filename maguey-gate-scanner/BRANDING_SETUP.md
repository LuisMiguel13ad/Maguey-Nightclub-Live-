# White-Label Branding System Setup Guide

This document outlines the setup steps for the white-label branding system.

## Database Migration

1. **Run the migration:**
   ```bash
   # The migration file is located at:
   # supabase/migrations/20250127000000_add_white_label_branding.sql
   ```

2. **Apply the migration to your Supabase database:**
   - Via Supabase Dashboard: Go to SQL Editor and run the migration file
   - Via CLI: `supabase db push` (if using Supabase CLI)

## Storage Bucket Setup

The branding system requires a Supabase Storage bucket for asset uploads.

1. **Create the storage bucket:**
   - Go to Supabase Dashboard → Storage
   - Create a new bucket named `venue-assets`
   - Set it to **Public** (or configure RLS policies as needed)

2. **Configure RLS Policies (if bucket is private):**
   ```sql
   -- Allow authenticated users to upload
   CREATE POLICY "Authenticated users can upload assets"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'venue-assets');

   -- Allow public read access
   CREATE POLICY "Public can read assets"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'venue-assets');
   ```

## TypeScript Types

After running the migration, regenerate your TypeScript types:

```bash
# If using Supabase CLI
supabase gen types typescript --local > src/integrations/supabase/types.ts

# Or manually add the new table types to types.ts
```

The new tables that need types are:
- `venues`
- `venue_branding`
- `venue_assets`
- `branding_templates`

## Features Implemented

### ✅ Core Features
- [x] Database schema for venues, branding, assets, and templates
- [x] Backend services for branding management
- [x] Asset upload with image optimization
- [x] Theming system with CSS variable injection
- [x] Live preview of branding changes
- [x] Color picker with hex input
- [x] Font selector with preview
- [x] Asset upload component with drag-and-drop
- [x] Export/import branding configuration
- [x] Template gallery
- [x] Multi-tenant support (venue-based)

### 🎨 Branding Elements
- Logo upload (multiple sizes/formats)
- Primary, secondary, and accent colors
- Font family selection
- Favicon support
- Custom CSS override
- Theme presets (default, vibrant, minimal)

### 📱 UI Components
- Branding configuration page (`/branding`)
- Live preview panel with responsive modes
- Color picker component
- Font selector component
- Asset upload component
- Template gallery

## Usage

1. **Access Branding Page:**
   - Navigate to `/branding` (only accessible to owners)
   - Or click "Branding" in the navigation menu

2. **Configure Branding:**
   - **Colors Tab:** Set primary, secondary, and accent colors
   - **Assets Tab:** Upload logos and favicon
   - **Typography Tab:** Select font family
   - **Advanced Tab:** Add custom CSS

3. **Live Preview:**
   - Changes are applied in real-time
   - Use preview mode buttons to see desktop/tablet/mobile views

4. **Save Changes:**
   - Click "Save Changes" to persist branding configuration
   - Changes are applied immediately across the application

5. **Export/Import:**
   - Export branding configuration as JSON
   - Import from JSON to restore or clone settings

## Multi-Tenant Support

The system supports multiple venues with separate branding:

- Each venue can have its own branding configuration
- Venues are identified by `venue_id`
- Default venue is created automatically with slug "default"
- Subdomain and custom domain support is available in the schema

## Asset Management

- Assets are stored in Supabase Storage (`venue-assets` bucket)
- Images are automatically optimized on upload
- Supports: PNG, JPEG, SVG, WebP, PDF
- Max file size: 10MB (configurable)

## Custom CSS

Custom CSS is injected globally. Use with caution and test thoroughly.

Example:
```css
/* Custom button styles */
button.primary {
  border-radius: 8px;
}

/* Custom card styles */
.card {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

## Template Marketplace

- Public templates are visible to all users
- Owners can create and share templates
- Apply templates with one click
- Templates include complete branding configuration

## Notes

- Branding is applied via CSS variables and custom CSS injection
- Favicon is updated dynamically
- Font families are loaded from Google Fonts (ensure fonts are available)
- Asset URLs are CDN-ready (Supabase Storage provides CDN URLs)

## Troubleshooting

1. **Branding not applying:**
   - Check browser console for errors
   - Verify CSS variables are being set correctly
   - Ensure BrandingProvider is wrapping the app

2. **Asset upload fails:**
   - Verify storage bucket exists and is configured
   - Check RLS policies allow uploads
   - Verify file size and type restrictions

3. **Font not loading:**
   - Ensure font is available (Google Fonts or self-hosted)
   - Check network tab for font loading errors
   - Verify font name matches exactly

## Future Enhancements

- Email template branding
- PDF ticket template customization
- Loading screen customization
- Subdomain/custom domain routing
- Organization-level defaults
- Event-specific overrides
- Asset versioning and rollback
- Template marketplace with previews

