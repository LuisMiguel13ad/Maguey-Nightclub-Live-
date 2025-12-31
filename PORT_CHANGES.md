# Port Changes Applied

## New Ports

### Purchase Site (maguey-pass-lounge)
- **Old Port:** 5173
- **New Port:** 3010
- **URL:** `http://localhost:3010`

### Scanner Site (maguey-gate-scanner)
- **Old Port:** 3005 (or 5174 if 3005 was in use)
- **New Port:** 3011
- **URL:** `http://localhost:3011`

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
   - Purchase: `http://localhost:3010`
   - Scanner: `http://localhost:3011`

## Changes Made

- Updated `maguey-pass-lounge/vite.config.ts` - port changed to 3010
- Updated `maguey-gate-scanner/vite.config.ts` - port changed to 3011






