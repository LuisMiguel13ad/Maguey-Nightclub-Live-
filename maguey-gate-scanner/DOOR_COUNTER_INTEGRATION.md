# Physical Door Counter Integration

This document describes the physical door counter integration feature that allows reconciliation between physical door counts and digital ticket scans.

## Overview

The door counter integration supports:
- IR beam counters
- Thermal sensors
- WiFi/Bluetooth door counter devices
- Bidirectional counting (entry/exit)
- Multiple entry point support
- Real-time data reconciliation

## Database Schema

### Tables Created

1. **door_counters** - Device registration and configuration
2. **physical_counts** - Entry/exit count data from physical devices
3. **count_discrepancies** - Reconciliation records for discrepancies

See migration file: `supabase/migrations/20250127000000_add_door_counter_integration.sql`

## API Endpoints

Supabase Edge Functions are located in `supabase/functions/`:

1. **POST /api/door-counter/ingest** (`door-counter-ingest/index.ts`)
   - Receives count data from physical devices
   - Requires API key authentication
   - Updates device heartbeat
   - Stores entry/exit counts

2. **GET /api/door-counter/status** (`door-counter-status/index.ts`)
   - Returns device health status
   - Shows latest count data
   - Requires device_id parameter

3. **POST /api/door-counter/calibrate** (`door-counter-calibrate/index.ts`)
   - Resets counter to zero
   - Requires API key authentication

4. **GET /api/capacity/unified** (`unified-capacity/index.ts`)
   - Returns combined physical + digital count
   - Requires event_id parameter

## Usage

### Registering a Door Counter

1. Navigate to **Door Counter Management** (`/door-counters`)
2. Click **Add Counter**
3. Fill in:
   - Device ID (unique identifier)
   - Device Name
   - Device Type (IR Beam, Thermal, WiFi, Bluetooth)
   - Location
   - API Endpoint (optional)
   - API Key (for authentication)

### Sending Count Data

Physical devices should POST to the ingest endpoint:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/door-counter-ingest \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "entry_count": 10,
    "exit_count": 2,
    "count_time": "2025-01-27T12:00:00Z"
  }'
```

### Viewing Unified Capacity

The Dashboard automatically displays:
- **Unified Capacity** - Combined physical + digital count
- **Discrepancy Alerts** - When physical and digital counts differ
- **Entry/Exit Flow** - Real-time visualization of traffic patterns

## Features

### Data Reconciliation

- Automatically compares physical counts vs digital scans
- Detects discrepancies (threshold: 5 by default)
- Flags when physical > digital (possible walk-ins or scanner issues)
- Flags when digital > physical (possible duplicate scans)

### Device Health Monitoring

- Tracks last heartbeat from each device
- Shows online/offline status
- Health status: Healthy, Warning, Critical, Unknown
- Automatic alerts for offline devices

### Discrepancy Resolution

- Manual investigation workflow
- Resolution notes and audit trail
- Status tracking: Pending, Investigating, Resolved, Ignored
- User attribution for all resolutions

## Database Functions

### `get_unified_capacity(event_id_param, check_time_param)`

Returns unified capacity combining physical and digital counts for an event.

### `detect_count_discrepancy(event_id_param, threshold_param)`

Detects and logs discrepancies between physical and digital counts.

### `get_counter_health_status(counter_id_param)`

Returns health status for a door counter device.

## TypeScript Types

Types are defined in `src/lib/door-counter-service.ts`:

- `DoorCounter`
- `PhysicalCount`
- `CountDiscrepancy`
- `UnifiedCapacity`
- `CounterHealthStatus`

## UI Components

1. **DoorCounterManagement** (`src/pages/DoorCounterManagement.tsx`)
   - Device registration and configuration
   - Health monitoring
   - Calibration tools

2. **UnifiedCapacityDisplay** (`src/components/UnifiedCapacityDisplay.tsx`)
   - Real-time unified count display
   - Discrepancy alerts
   - Auto-refresh every 30 seconds

3. **DiscrepancyAlerts** (`src/components/DiscrepancyAlerts.tsx`)
   - Lists all discrepancies
   - Investigation and resolution tools
   - Audit trail

4. **EntryExitFlowVisualization** (`src/components/EntryExitFlowVisualization.tsx`)
   - Entry/exit flow charts
   - Time range selection
   - Multiple counter support

## Security

- API key authentication for device endpoints
- Row Level Security (RLS) policies enabled
- Service role required for data ingestion
- Staff-only access to management interfaces

## Fire Marshal Compliance

The unified capacity view provides:
- Real-time occupancy display
- Combined physical + digital count
- Historical accuracy tracking
- Audit trail for all adjustments

## Next Steps

1. Run the migration: `supabase migration up`
2. Register your physical door counter devices
3. Configure devices to POST to the ingest endpoint
4. Monitor unified capacity on the Dashboard
5. Investigate and resolve any discrepancies

## Troubleshooting

### Device Not Showing Heartbeat

- Verify API key is correct
- Check device is posting to correct endpoint
- Ensure device is marked as active in management interface

### Discrepancies Not Detected

- Check threshold setting (default: 5)
- Verify both physical and digital counts are updating
- Ensure event is active

### Unified Capacity Not Updating

- Verify real-time subscriptions are active
- Check device heartbeat is recent
- Ensure event_id matches active event

