# Event Duplicate Prevention System

## Overview
This system prevents duplicate events from being created across all entry points in the application.

## Implementation

### 1. Owner Dashboard (EventManagement.tsx)
- **Location**: `maguey-gate-scanner/src/pages/EventManagement.tsx`
- **How it works**: Before creating a new event, the system checks for existing events with:
  - Similar name (case-insensitive partial match)
  - Same event date
- **Action**: If a duplicate is found, creation is blocked with a clear error message showing the existing event ID

### 2. Event Creation Scripts
- **Location**: `maguey-gate-scanner/create-*-event.ts` files
- **How it works**: All event creation scripts now include a `checkForDuplicate()` function that:
  - Queries the database for events with matching name and date
  - Returns early with an error if duplicate found
  - Prevents script execution if duplicate exists
- **Example**: `create-mister-kumbia-event.ts`

### 3. Reusable Utility Function
- **Location**: `maguey-gate-scanner/src/lib/event-duplicate-check.ts`
- **Functions**:
  - `checkForDuplicateEvent()`: Checks for duplicates
  - `getDuplicateErrorMessage()`: Returns user-friendly error messages
- **Usage**: Can be imported and used in any component or script

## Duplicate Detection Criteria

An event is considered a duplicate if:
1. **Name Match**: Event name contains similar text (case-insensitive, partial match)
2. **Date Match**: Event date is exactly the same (YYYY-MM-DD format)

## Error Messages

When a duplicate is detected:
- **Owner Dashboard**: Shows toast notification with existing event ID
- **Scripts**: Logs error and exits with status code 1
- **Message Format**: "Duplicate event detected! An event with the name '[name]' and date [date] already exists (ID: [id]). Please edit the existing event instead of creating a duplicate."

## Best Practices

1. **Always check before creating**: The system automatically checks, but be aware of this when creating events manually
2. **Edit instead of duplicate**: If an event exists, edit it rather than creating a new one
3. **Use the owner dashboard**: The dashboard provides the safest way to create events with full validation

## Testing

To test duplicate prevention:
1. Try creating an event with the same name and date as an existing event
2. The system should block creation and show an error message
3. Verify no duplicate was created in the database

## Future Enhancements

Potential improvements:
- Add database-level unique constraint (name + date)
- Add fuzzy matching for similar event names
- Add admin override for legitimate duplicates
- Add duplicate detection report/cleanup tool

