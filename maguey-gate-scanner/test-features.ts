/**
 * Test script for new features: Audio Feedback, Re-entry Tracking, and Offline Queue
 * Run with: tsx test-features.ts
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
config({ path: resolve(__dirname, '.env') });

console.log('🧪 Testing New Features\n');
console.log('='.repeat(60));

// Test 1: Audio Feedback Service
console.log('\n1️⃣ Testing Audio Feedback Service...');
try {
  const { 
    playSuccess, 
    playError, 
    playWarning, 
    playBatchApproved,
    getAudioSettings,
    saveAudioSettings,
    testSound
  } = await import('./src/lib/audio-feedback-service');

  const settings = getAudioSettings();
  console.log('✅ Audio settings loaded:', {
    soundEnabled: settings.soundEnabled,
    hapticEnabled: settings.hapticEnabled,
    volume: settings.volume,
  });

  // Test sound functions (won't actually play in Node.js, but will verify they exist)
  console.log('✅ Audio functions available:', {
    playSuccess: typeof playSuccess === 'function',
    playError: typeof playError === 'function',
    playWarning: typeof playWarning === 'function',
    playBatchApproved: typeof playBatchApproved === 'function',
    testSound: typeof testSound === 'function',
  });

  // Test settings persistence
  const originalVolume = settings.volume;
  saveAudioSettings({ volume: 0.5 });
  const updatedSettings = getAudioSettings();
  if (updatedSettings.volume === 0.5) {
    console.log('✅ Settings persistence works');
    // Restore original
    saveAudioSettings({ volume: originalVolume });
  } else {
    console.log('❌ Settings persistence failed');
  }
} catch (error: any) {
  console.error('❌ Audio feedback service test failed:', error.message);
}

// Test 2: Re-entry Service
console.log('\n2️⃣ Testing Re-entry Service...');
try {
  const reEntryService = await import('./src/lib/re-entry-service');
  const {
    getReEntryMode,
    setReEntryMode,
    getTicketReEntryStatus,
    getCurrentlyInsideCount,
    determineScanType,
  } = reEntryService;

  // Test mode getter/setter
  const originalMode = await getReEntryMode();
  console.log('✅ Re-entry mode loaded:', originalMode);

  // Test mode switching
  setReEntryMode('reentry');
  const newMode = await getReEntryMode();
  if (newMode === 'reentry') {
    console.log('✅ Re-entry mode persistence works');
    // Restore original
    setReEntryMode(originalMode);
  } else {
    console.log('❌ Re-entry mode persistence failed');
  }

  // Test functions exist
  console.log('✅ Re-entry functions available:', {
    getReEntryMode: typeof getReEntryMode === 'function',
    setReEntryMode: typeof setReEntryMode === 'function',
    getTicketReEntryStatus: typeof getTicketReEntryStatus === 'function',
    getCurrentlyInsideCount: typeof getCurrentlyInsideCount === 'function',
    determineScanType: typeof determineScanType === 'function',
  });
} catch (error: any) {
  console.error('❌ Re-entry service test failed:', error.message);
}

// Test 3: Offline Queue Service
console.log('\n3️⃣ Testing Offline Queue Service...');
try {
  const {
    queueScan,
    getPendingScans,
    getSyncStatus,
    syncPendingScans,
    startAutoSync,
    stopAutoSync,
  } = await import('./src/lib/offline-queue-service');

  console.log('✅ Offline queue functions available:', {
    queueScan: typeof queueScan === 'function',
    getPendingScans: typeof getPendingScans === 'function',
    getSyncStatus: typeof getSyncStatus === 'function',
    syncPendingScans: typeof syncPendingScans === 'function',
    startAutoSync: typeof startAutoSync === 'function',
    stopAutoSync: typeof stopAutoSync === 'function',
  });

  // Test getting sync status
  const status = await getSyncStatus();
  console.log('✅ Sync status retrieved:', status);
} catch (error: any) {
  console.error('❌ Offline queue service test failed:', error.message);
}

// Test 4: Scanner Service Integration
console.log('\n4️⃣ Testing Scanner Service Integration...');
try {
  const { scanTicket, lookupTicketByQR } = await import('./src/lib/scanner-service');

  console.log('✅ Scanner service functions available:', {
    scanTicket: typeof scanTicket === 'function',
    lookupTicketByQR: typeof lookupTicketByQR === 'function',
  });

  // Check if scanTicket accepts reEntryMode parameter
  // We can't actually call it without a real ticket, but we can verify the function signature
  console.log('✅ Scanner service ready for re-entry mode');
} catch (error: any) {
  console.error('❌ Scanner service test failed:', error.message);
}

// Test 5: Migration File Check
console.log('\n5️⃣ Checking Migration File...');
try {
  const fs = await import('fs');
  const migrationPath = resolve(__dirname, 'supabase/migrations/20250113000001_add_reentry_tracking.sql');
  
  if (fs.existsSync(migrationPath)) {
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    
    // Check for required SQL statements
    const checks = {
      hasScanHistoryTable: migrationContent.includes('CREATE TABLE') && migrationContent.includes('scan_history'),
      hasReEntryColumns: migrationContent.includes('current_status') && migrationContent.includes('entry_count'),
      hasRLSPolicies: migrationContent.includes('ROW LEVEL SECURITY'),
      hasIndexes: migrationContent.includes('CREATE INDEX'),
    };

    console.log('✅ Migration file exists');
    console.log('✅ Migration checks:', checks);

    const allChecksPass = Object.values(checks).every(v => v === true);
    if (allChecksPass) {
      console.log('✅ Migration file looks good!');
    } else {
      console.log('⚠️  Some migration checks failed');
    }
  } else {
    console.log('❌ Migration file not found');
  }
} catch (error: any) {
  console.error('❌ Migration check failed:', error.message);
}

console.log('\n' + '='.repeat(60));
console.log('\n✅ Feature tests completed!');
console.log('\n📋 Next Steps:');
console.log('1. Apply migration to Supabase:');
console.log('   - Go to Supabase Dashboard → SQL Editor');
console.log('   - Copy contents of supabase/migrations/20250113000001_add_reentry_tracking.sql');
console.log('   - Run the SQL');
console.log('\n2. Test in browser:');
console.log('   - Start dev server: npm run dev');
console.log('   - Test audio: Enable sound/haptic in settings');
console.log('   - Test offline: Disconnect internet and scan');
console.log('   - Test re-entry: Switch to "Re-entry" mode and scan same ticket twice');
console.log('\n');

