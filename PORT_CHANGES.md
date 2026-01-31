# Port Changes Applied

## New Ports

### Main Site (maguey-nights)
- **Port:** 3017
- **URL:** `http://localhost:3017`

### Purchase Site (maguey-pass-lounge)
- **Port:** 3016
- **URL:** `http://localhost:3016`

### Scanner/Owner Site (maguey-gate-scanner)
- **Port:** 3015
- **URL:** `http://localhost:3015`

## Next Steps

1. **Stop current dev servers** (Ctrl+C in terminals)

2. **Restart dev servers:**
   ```bash
   # Terminal 1 - Purchase Site
   cd maguey-pass-lounge
   npm run dev
   
   # Terminal 2 - Scanner Site
   cd maguey-gate-scanner
   npm run dev
   ```

3. **Access the sites:**
   - Main Site: `http://localhost:3017`
   - Purchase: `http://localhost:3016`
   - Scanner: `http://localhost:3015`

## Changes Made

- Updated `maguey-nights/vite.config.ts` - port set to 3017
- Updated `maguey-pass-lounge/vite.config.ts` - port set to 3016
- Updated `maguey-gate-scanner/vite.config.ts` - port set to 3015










