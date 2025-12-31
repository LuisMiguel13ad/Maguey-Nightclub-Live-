# Guest List Management Implementation Summary

## Overview

Guest list management system implemented for `maguey-pass-lounge` allowing promoters to add names and door staff to check them in.

---

## Files Created/Updated

### Database Migration (1 file)
1. `supabase/migrations/20250623000000_guest_lists.sql` - Complete guest list schema
   - `guest_list_type` enum (vip, comp, reduced, standard)
   - `guest_status` enum (pending, checked_in, no_show, cancelled)
   - `guest_lists` table (one per event)
   - `guest_list_entries` table (individual guests)
   - Indexes for performance
   - `guest_list_summary` view
   - `check_in_guest()` function
   - `search_guest_list()` function
   - RLS policies

### Service Layer (1 file)
2. `src/lib/guest-list-service.ts` - Complete guest list service
   - `createGuestList()` - Create new guest list
   - `addGuest()` - Add individual guest
   - `addGuestsBulk()` - Bulk import guests
   - `getEventGuestLists()` - Get all lists for event
   - `getGuestListEntries()` - Get guests on a list
   - `searchEventGuests()` - Search across all lists
   - `checkInGuest()` - Check in a guest
   - `removeGuest()` - Remove guest from list
   - `getGuestListStats()` - Get statistics

### UI Components (4 files)
3. `src/components/admin/GuestListTable.tsx` - Reusable table component
   - Search and filter functionality
   - Status badges
   - List type badges
   - Check-in, edit, remove actions
   - Responsive design

4. `src/components/admin/AddGuestForm.tsx` - Add guest form
   - Individual guest entry
   - Quick add mode (name + plus ones)
   - Full form (name, email, phone, plus ones, notes)
   - Validation

5. `src/components/admin/BulkGuestImport.tsx` - Bulk import component
   - Text paste (one name per line)
   - CSV file upload
   - Parses formats: "Name", "Name +2", "Name, +2, Notes"
   - Preview before import
   - Duplicate detection

6. `src/pages/admin/GuestListManager.tsx` - Main admin page
   - Event selection
   - Tabbed interface (VIP, Comp, Reduced, Standard)
   - Stats dashboard
   - Create lists on demand
   - Manage guests per list

### Navigation Updates (2 files)
7. Updated `src/pages/admin/AdminDashboard.tsx` - Added route
8. Updated `src/components/admin/AdminSidebar.tsx` - Added navigation link

**Total: 8 files created/updated**

---

## Database Schema

### guest_lists Table
- `id` - UUID primary key
- `event_id` - References events
- `name` - List name (e.g., "Friday Night Guest List")
- `list_type` - vip, comp, reduced, standard
- `max_guests` - Optional capacity limit
- `closes_at` - When list stops accepting names
- `cover_charge` - Cover for this list type
- `is_active` - Active status

### guest_list_entries Table
- `id` - UUID primary key
- `guest_list_id` - References guest_lists
- `guest_name` - Guest name (required)
- `guest_email` - Optional email
- `guest_phone` - Optional phone
- `plus_ones` - Number of additional guests
- `notes` - Notes (e.g., "Birthday girl", "Industry")
- `status` - pending, checked_in, no_show, cancelled
- `checked_in_at` - Check-in timestamp
- `checked_in_by` - User who checked in
- `actual_plus_ones` - How many plus ones actually came
- `added_by` - User who added guest
- `added_by_name` - Promoter name for display
- `source` - 'promoter', 'owner', 'online', etc.

### Unique Constraint
- `UNIQUE(guest_list_id, guest_name, guest_phone)` - Prevents duplicates

---

## Guest List Types

| Type | Description | Default Cover |
|------|-------------|---------------|
| `vip` | VIP treatment, skip line | $0 |
| `comp` | Free entry (complimentary) | $0 |
| `reduced` | Reduced cover charge | $10 |
| `standard` | Standard guest list (may still pay) | $20 |

---

## Features

### For Promoters/Admins

1. **Create Guest Lists**
   - Create lists by type (VIP, Comp, Reduced, Standard)
   - Set capacity limits
   - Set closing time
   - Set cover charge

2. **Add Guests**
   - Individual entry form
   - Quick add (name + plus ones)
   - Bulk import (paste names or CSV)
   - Supports formats:
     - "John Doe"
     - "Jane Smith +2"
     - "Bob Johnson, +1, VIP"
     - "Alice Williams +3 Birthday"

3. **Manage Guests**
   - View all guests on a list
   - Search by name, email, phone, notes
   - Filter by status
   - Edit guest information
   - Remove guests

4. **Statistics**
   - Total guests per event
   - Checked in count
   - Pending count
   - Plus ones count
   - Breakdown by list type

### For Door Staff

1. **Search Guests**
   - Search across all lists for an event
   - Quick name lookup
   - Shows list type and cover charge

2. **Check In**
   - One-click check-in
   - Record actual plus ones
   - Timestamp tracking
   - User attribution

---

## Usage Examples

### Create a Guest List

```typescript
const result = await createGuestList(eventId, {
  name: 'VIP List',
  listType: 'vip',
  maxGuests: 50,
  coverCharge: 0,
});

if (isOk(result)) {
  console.log('List created:', result.data.id);
}
```

### Add a Guest

```typescript
const result = await addGuest(guestListId, {
  guestName: 'John Doe',
  guestEmail: 'john@example.com',
  guestPhone: '555-1234',
  plusOnes: 2,
  notes: 'Birthday girl',
  addedByName: 'Promoter Name',
});

if (isOk(result)) {
  console.log('Guest added:', result.data.id);
}
```

### Bulk Import

```typescript
const guests = [
  { guestName: 'John Doe', plusOnes: 2 },
  { guestName: 'Jane Smith', plusOnes: 0, notes: 'VIP' },
];

const result = await addGuestsBulk(guestListId, guests, 'Promoter Name');

if (isOk(result)) {
  console.log(`Added ${result.data.added}, ${result.data.duplicates} duplicates`);
}
```

### Check In Guest

```typescript
const result = await checkInGuest(entryId, userId, 2); // 2 actual plus ones

if (isOk(result)) {
  console.log('Guest checked in:', result.data.guestName);
}
```

### Search Guests

```typescript
const result = await searchEventGuests(eventId, 'John');

if (isOk(result)) {
  result.data.forEach(guest => {
    console.log(`${guest.guestName} - ${guest.listType} - ${guest.coverCharge}`);
  });
}
```

---

## UI Components

### GuestListManager
- Event selector dropdown
- Stats cards (total, checked in, pending, plus ones)
- Tabbed interface for list types
- Create list button (if list doesn't exist)
- Add guest and bulk import buttons

### GuestListTable
- Searchable table
- Status filter
- Sortable columns
- Status badges (color-coded)
- List type badges
- Action buttons (check in, edit, remove)

### AddGuestForm
- Modal dialog
- Name (required)
- Email (optional)
- Phone (optional)
- Plus ones (0-10)
- Notes (optional)
- Quick add mode toggle

### BulkGuestImport
- Textarea for pasting names
- CSV file upload
- Live preview
- Format examples
- Summary (total guests, plus ones)

---

## Database Functions

### check_in_guest()
```sql
SELECT * FROM check_in_guest(
  p_entry_id := 'uuid',
  p_checked_in_by := 'user-uuid',
  p_actual_plus_ones := 2
);
```

### search_guest_list()
```sql
SELECT * FROM search_guest_list(
  p_event_id := 'event-uuid',
  p_search_term := 'John'
);
```

---

## Statistics

The `getGuestListStats()` function returns:
- `totalLists` - Number of guest lists
- `totalGuests` - Total guest entries
- `totalPlusOnes` - Total plus ones
- `checkedIn` - Number checked in
- `pending` - Number pending
- `byListType` - Breakdown by list type

---

## Build Status

✅ **maguey-pass-lounge**: Build successful

---

## Next Steps

1. **Apply Migration**: Run the migration to create tables
   ```bash
   supabase migration up
   ```

2. **Test Guest Lists**: 
   - Create a guest list for an event
   - Add individual guests
   - Test bulk import
   - Check in guests

3. **Part 2**: Implement door staff interface in `maguey-gate-scanner`

---

## Summary

✅ **Database schema** created with enums, tables, views, and functions
✅ **Service layer** with all CRUD operations
✅ **Admin UI** with tabs, tables, forms, and bulk import
✅ **Navigation** integrated into admin dashboard
✅ **Build successful**

The guest list management system is complete and ready for use. Promoters can add names, and door staff can check them in efficiently.
