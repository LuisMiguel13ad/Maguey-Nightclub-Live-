# Owner Event Upload Guide

This guide explains how to create and manage events in the Owner Portal, including single event creation and bulk imports.

## Table of Contents

1. [Creating a Single Event](#creating-a-single-event)
2. [Bulk Import via CSV](#bulk-import-via-csv)
3. [Bulk Import via Excel](#bulk-import-via-excel)
4. [CSV Format Specifications](#csv-format-specifications)
5. [Ticket Type Management](#ticket-type-management)
6. [Event Images](#event-images)
7. [Troubleshooting](#troubleshooting)

---

## Creating a Single Event

### Steps

1. Navigate to **Owner Portal** → **Events**
2. Click **"New Event"** button
3. Fill in the event details:
   - **Event Name** (required): e.g., "Perreo Fridays"
   - **Venue Name**: e.g., "Club Maguey"
   - **Venue Address**: e.g., "123 Main St"
   - **City**: e.g., "Austin"
   - **Description**: Event description (optional)
   - **Event Date** (required): Select date
   - **Event Time** (required): Select time (HH:MM format)
   - **Event Image**: Upload flyer or promotional image (optional)

4. Add Ticket Types:
   - Click **"Add Type"** to add ticket types
   - For each ticket type, specify:
     - **Name**: e.g., "General Admission", "VIP"
     - **Price**: Ticket price in dollars
     - **Capacity**: Number of tickets available

5. Click **"Create Event"** to save

### Notes

- At least one ticket type is required
- Ticket prices must be non-negative
- Ticket capacity must be positive
- Event images are automatically uploaded to Supabase Storage
- Images display on all three websites (Main, Purchase, Scanner)

---

## Bulk Import via CSV

### Quick Start

1. Click **"Bulk Import"** button on Events page
2. Click **"Download Template"** to get the CSV template
3. Fill out the template with your events
4. Upload the completed CSV file
5. Review validation results
6. Choose ticket type management strategy
7. Click **"Import"** to create events

### CSV Format

The CSV must include these columns:

- `event_name` (required)
- `event_date` (required, format: YYYY-MM-DD)
- `event_time` (optional, format: HH:MM, default: 20:00)
- `venue_name` (optional, recommended)
- `venue_address` (optional)
- `city` (optional)
- `description` (optional)
- `image_url` (optional, URL to image)
- `ticket_type_name` (required)
- `ticket_type_price` (required, number)
- `ticket_type_capacity` (required, positive integer)

### Example CSV

```csv
event_name,event_date,event_time,venue_name,venue_address,city,description,image_url,ticket_type_name,ticket_type_price,ticket_type_capacity
New Years Eve Party,2025-12-31,21:00,Club Maguey,123 Main St,Austin,Ring in 2025!,,General Admission,50,200
New Years Eve Party,2025-12-31,21:00,Club Maguey,123 Main St,Austin,Ring in 2025!,,VIP,150,50
Valentine's Dance,2025-02-14,20:00,Club Maguey,123 Main St,Austin,Love is in the air!,,Couples Pass,75,100
```

### Multiple Ticket Types per Event

To add multiple ticket types to the same event, create multiple rows with the same `event_name` and `event_date`:

```csv
event_name,event_date,event_time,venue_name,venue_address,city,description,image_url,ticket_type_name,ticket_type_price,ticket_type_capacity
Summer Festival,2025-07-15,19:00,Club Maguey,123 Main St,Austin,Summer vibes!,,Early Bird,30,100
Summer Festival,2025-07-15,19:00,Club Maguey,123 Main St,Austin,Summer vibes!,,General Admission,50,300
Summer Festival,2025-07-15,19:00,Club Maguey,123 Main St,Austin,Summer vibes!,,VIP,100,50
```

---

## Bulk Import via Excel

### Supported Formats

- `.xlsx` (Excel 2007+)
- `.xls` (Excel 97-2003)

### Steps

1. Open Excel or Google Sheets
2. Create a sheet with the same columns as CSV format (see above)
3. Fill in your event data
4. Save as `.xlsx` or `.xls`
5. Upload via Bulk Import dialog
6. Review validation results
7. Import events

### Notes

- The first sheet in the workbook will be used
- Column headers must match CSV format exactly
- Same validation rules apply as CSV

---

## CSV Format Specifications

### Required Fields

| Field | Type | Format | Example |
|-------|------|--------|---------|
| `event_name` | Text | Any | "Perreo Fridays" |
| `event_date` | Date | YYYY-MM-DD | "2025-12-31" |
| `ticket_type_name` | Text | Any | "General Admission" |
| `ticket_type_price` | Number | Decimal | "50.00" or "50" |
| `ticket_type_capacity` | Integer | Positive | "200" |

### Optional Fields

| Field | Type | Format | Example |
|-------|------|--------|---------|
| `event_time` | Time | HH:MM | "21:00" (default: "20:00") |
| `venue_name` | Text | Any | "Club Maguey" |
| `venue_address` | Text | Any | "123 Main St" |
| `city` | Text | Any | "Austin" |
| `description` | Text | Any | "Ring in 2025!" |
| `image_url` | URL | Valid URL | "https://example.com/image.jpg" |

### Validation Rules

- **Event Name**: Cannot be empty
- **Event Date**: Must be valid date in YYYY-MM-DD format
- **Event Time**: Must be in HH:MM format (24-hour)
- **Ticket Type Name**: Cannot be empty
- **Ticket Type Price**: Must be number >= 0
- **Ticket Type Capacity**: Must be positive integer > 0

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Event name is required" | Empty event_name | Fill in event name |
| "Invalid date format" | Wrong date format | Use YYYY-MM-DD (e.g., 2025-12-31) |
| "Time must be in HH:MM format" | Wrong time format | Use 24-hour format (e.g., 21:00) |
| "Invalid price" | Non-numeric price | Use numbers only (e.g., 50 or 50.00) |
| "Invalid capacity" | Non-integer capacity | Use whole numbers only (e.g., 200) |

---

## Ticket Type Management

When importing events, you can choose how to handle ticket types:

### Auto-Create (Default)

- **Behavior**: Automatically creates new ticket types for each event
- **Use When**: Creating new events with unique ticket types
- **Example**: "Summer Festival" with "Early Bird" tickets → Creates new ticket type

### Reuse Existing

- **Behavior**: Checks if ticket type name already exists (case-insensitive)
- **If Match Found**: Reuses existing ticket type configuration (price, capacity)
- **If No Match**: Creates new ticket type
- **Use When**: You have standard ticket types used across multiple events
- **Example**: "General Admission" exists → Reuses it; "VIP Special" doesn't exist → Creates new

### Manual Selection

- **Behavior**: Currently same as Auto-Create (manual selection UI coming soon)
- **Use When**: You want full control over which ticket types to reuse

---

## Event Images

### Uploading Images

1. **Single Event**: Use the image upload field in the event form
2. **Bulk Import**: Include `image_url` column in CSV/Excel (URL to hosted image)

### Image Requirements

- **Formats**: JPG, PNG, WebP, GIF
- **Max Size**: 5MB
- **Recommended**: 1200x800px or similar aspect ratio

### Image Display

Event images automatically display on:
- **Main Website**: Event cards and detail pages
- **Purchase Website**: Event detail pages
- **Scanner Website**: Event management table

### Image Storage

- Images are stored in Supabase Storage bucket: `event-images`
- Public URLs are generated automatically
- Images are organized by event ID

---

## Troubleshooting

### "Create Events" Button Shows Error

**Problem**: Button shows "undefined" error

**Solution**: This has been fixed. If you still see errors:
1. Refresh the page
2. Clear browser cache
3. Check browser console for specific errors

### CSV Import Fails

**Problem**: Import shows validation errors

**Solutions**:
1. Check error messages for specific row/field issues
2. Ensure all required fields are filled
3. Verify date format is YYYY-MM-DD
4. Verify time format is HH:MM (24-hour)
5. Ensure prices and capacities are valid numbers

### Image Upload Fails

**Problem**: Image doesn't upload

**Solutions**:
1. Check file size (must be < 5MB)
2. Check file format (JPG, PNG, WebP, GIF only)
3. Ensure you're logged in as owner
4. Check browser console for errors

### Ticket Types Not Showing

**Problem**: Created event but ticket types missing

**Solutions**:
1. Refresh the events list
2. Check that ticket types were saved (edit event to verify)
3. Ensure at least one ticket type was provided
4. Check browser console for errors

### Events Not Appearing on Other Websites

**Problem**: Event created but not visible on Main/Purchase sites

**Solutions**:
1. Verify event has valid date (future dates only)
2. Check that `image_url` is set (recommended)
3. Ensure event data is saved correctly
4. Check if websites are configured to fetch from correct database

---

## Best Practices

1. **Use Templates**: Always download and use the CSV template
2. **Validate Data**: Review validation results before importing
3. **Test First**: Import a single event first to test your format
4. **Image URLs**: Use reliable image hosting for bulk imports
5. **Consistent Naming**: Use consistent ticket type names for reuse
6. **Backup**: Export your events before bulk operations

---

## Support

If you encounter issues not covered in this guide:

1. Check browser console for error messages
2. Review validation errors in bulk import preview
3. Verify database connection is working
4. Contact system administrator

---

## Quick Reference

### CSV Template Columns

```
event_name, event_date, event_time, venue_name, venue_address, city, description, image_url, ticket_type_name, ticket_type_price, ticket_type_capacity
```

### Date Format
```
YYYY-MM-DD (e.g., 2025-12-31)
```

### Time Format
```
HH:MM (e.g., 21:00)
```

### File Formats Supported
- CSV (.csv)
- Excel (.xlsx, .xls)

### Image Formats Supported
- JPG/JPEG
- PNG
- WebP
- GIF

---

**Last Updated**: November 2025

