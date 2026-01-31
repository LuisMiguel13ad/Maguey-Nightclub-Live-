/**
 * Audio and Haptic Feedback Service
 * Provides sound and vibration feedback for scan events
 */

// Audio settings stored in localStorage
const STORAGE_KEY_SOUND_ENABLED = 'scanner_sound_enabled';
const STORAGE_KEY_HAPTIC_ENABLED = 'scanner_haptic_enabled';
const STORAGE_KEY_VOLUME = 'scanner_volume';

// Default settings
const DEFAULT_SOUND_ENABLED = true;
const DEFAULT_HAPTIC_ENABLED = true;
const DEFAULT_VOLUME = 0.7; // 70%

/**
 * Get audio context (singleton pattern)
 */
let audioContext: AudioContext | null = null;
const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('[audio-feedback] AudioContext not available:', error);
      return null;
    }
  }
  
  // Resume context if suspended (required for user interaction)
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {
      // Ignore errors - context might not be ready
    });
  }
  
  return audioContext;
};

/**
 * Play a tone using Web Audio API
 */
const playTone = (frequency: number, duration: number, volume: number = 0.7): void => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';

  // Fade in/out for smoother sound
  const now = ctx.currentTime;
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
  gainNode.gain.linearRampToValueAtTime(volume, now + duration - 0.01);
  gainNode.gain.linearRampToValueAtTime(0, now + duration);

  oscillator.start(now);
  oscillator.stop(now + duration);
};

/**
 * Trigger haptic feedback
 */
const triggerVibration = (pattern: number | number[]): void => {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  
  try {
    navigator.vibrate(pattern);
  } catch (error) {
    console.warn('[audio-feedback] Vibration not available:', error);
  }
};

/**
 * Get settings from localStorage
 */
export const getAudioSettings = (): {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  volume: number;
} => {
  if (typeof window === 'undefined') {
    return {
      soundEnabled: DEFAULT_SOUND_ENABLED,
      hapticEnabled: DEFAULT_HAPTIC_ENABLED,
      volume: DEFAULT_VOLUME,
    };
  }

  const soundEnabled = localStorage.getItem(STORAGE_KEY_SOUND_ENABLED);
  const hapticEnabled = localStorage.getItem(STORAGE_KEY_HAPTIC_ENABLED);
  const volume = localStorage.getItem(STORAGE_KEY_VOLUME);

  return {
    soundEnabled: soundEnabled !== null ? soundEnabled === 'true' : DEFAULT_SOUND_ENABLED,
    hapticEnabled: hapticEnabled !== null ? hapticEnabled === 'true' : DEFAULT_HAPTIC_ENABLED,
    volume: volume !== null ? parseFloat(volume) : DEFAULT_VOLUME,
  };
};

/**
 * Save settings to localStorage
 */
export const saveAudioSettings = (settings: {
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
  volume?: number;
}): void => {
  if (typeof window === 'undefined') return;

  if (settings.soundEnabled !== undefined) {
    localStorage.setItem(STORAGE_KEY_SOUND_ENABLED, String(settings.soundEnabled));
  }
  if (settings.hapticEnabled !== undefined) {
    localStorage.setItem(STORAGE_KEY_HAPTIC_ENABLED, String(settings.hapticEnabled));
  }
  if (settings.volume !== undefined) {
    localStorage.setItem(STORAGE_KEY_VOLUME, String(settings.volume));
  }
};

/**
 * Play ascending chime for VIP (400Hz → 600Hz)
 */
const playVIPChime = (volume: number): void => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const frequencies = [400, 500, 600];
  const duration = 0.15;

  frequencies.forEach((freq, index) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = freq;
    oscillator.type = 'sine';

    const startTime = now + index * 0.05;
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.6, startTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(volume * 0.6, startTime + duration - 0.01);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  });
};

/**
 * Play triple beep for Premium
 */
const playPremiumBeep = (volume: number): void => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const beeps = [440, 440, 440];
  const duration = 0.08;
  const gap = 0.05;

  beeps.forEach((freq, index) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = freq;
    oscillator.type = 'sine';

    const startTime = now + index * (duration + gap);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.7, startTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(volume * 0.7, startTime + duration - 0.01);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  });
};

/**
 * Play special chime for Backstage
 */
const playBackstageChime = (volume: number): void => {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Play a distinctive chord sequence
  const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C (higher octave)
  const duration = 0.2;

  frequencies.forEach((freq, index) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = freq;
    oscillator.type = 'sine';

    const startTime = now + index * 0.03;
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.5, startTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(volume * 0.5, startTime + duration - 0.01);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  });
};

/**
 * Distinct haptic patterns per context decision:
 * - Success: quick buzz (50ms)
 * - Rejection: longer pattern (200, 100, 200)
 * - VIP: triple pulse (50, 30, 50, 30, 50)
 * - Re-entry: double pulse (100, 50, 100)
 */

/**
 * Success: Quick buzz (per context: quick buzz for success)
 */
export const hapticSuccess = (): void => {
  const settings = getAudioSettings();
  if (settings.hapticEnabled && navigator.vibrate) {
    navigator.vibrate(50);
  }
};

/**
 * Rejection: Longer pattern (per context: longer for rejection)
 */
export const hapticRejection = (): void => {
  const settings = getAudioSettings();
  if (settings.hapticEnabled && navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
};

/**
 * VIP success: Triple pulse pattern
 */
export const hapticVIP = (): void => {
  const settings = getAudioSettings();
  if (settings.hapticEnabled && navigator.vibrate) {
    navigator.vibrate([50, 30, 50, 30, 50]);
  }
};

/**
 * Re-entry: Double pulse pattern
 */
export const hapticReentry = (): void => {
  const settings = getAudioSettings();
  if (settings.hapticEnabled && navigator.vibrate) {
    navigator.vibrate([100, 50, 100]);
  }
};

/**
 * Play success feedback (400Hz, 100ms) + vibration (50ms)
 */
export const playSuccess = (): void => {
  const settings = getAudioSettings();

  if (settings.soundEnabled) {
    playTone(400, 0.1, settings.volume);
  }

  hapticSuccess(); // Use distinct pattern function
};

/**
 * Play tier-specific success sound
 * @param tier - Ticket tier ('general', 'vip', 'premium', 'backstage', or custom)
 */
export const playTierSuccess = (tier: string | null | undefined): void => {
  const settings = getAudioSettings();
  const normalizedTier = (tier || 'general').toLowerCase();
  
  if (!settings.soundEnabled) {
    if (settings.hapticEnabled) {
      triggerVibration(50);
    }
    return;
  }

  switch (normalizedTier) {
    case 'vip':
      playVIPChime(settings.volume);
      if (settings.hapticEnabled) {
        triggerVibration([50, 30, 50]); // Double vibration for VIP
      }
      break;
    case 'premium':
      playPremiumBeep(settings.volume);
      if (settings.hapticEnabled) {
        triggerVibration([50, 20, 50, 20, 50]); // Triple vibration
      }
      break;
    case 'backstage':
      playBackstageChime(settings.volume);
      if (settings.hapticEnabled) {
        triggerVibration([100, 50, 100, 50, 100]); // Special pattern
      }
      break;
    default:
      // General tier - use standard success sound
      playSuccess();
      break;
  }
};

/**
 * Play error feedback (200Hz, 200ms) + rejection vibration pattern
 */
export const playError = (): void => {
  const settings = getAudioSettings();

  if (settings.soundEnabled) {
    playTone(200, 0.2, settings.volume);
  }

  hapticRejection(); // Use distinct rejection pattern (200, 100, 200)
};

/**
 * Play warning feedback (300Hz, 150ms) + long vibration
 */
export const playWarning = (): void => {
  const settings = getAudioSettings();
  
  if (settings.soundEnabled) {
    playTone(300, 0.15, settings.volume);
  }
  
  if (settings.hapticEnabled) {
    triggerVibration(200); // Long vibration
  }
};

/**
 * Play batch approved celebration chime
 */
export const playBatchApproved = (): void => {
  const settings = getAudioSettings();
  
  if (settings.soundEnabled) {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Play a pleasant chord sequence
    const now = ctx.currentTime;
    const frequencies = [523.25, 659.25, 783.99]; // C, E, G chord
    const duration = 0.3;

    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = freq;
      oscillator.type = 'sine';

      const startTime = now + index * 0.05;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(settings.volume * 0.5, startTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(settings.volume * 0.5, startTime + duration - 0.01);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    });
  }
  
  if (settings.hapticEnabled) {
    triggerVibration([100, 50, 100]); // Celebration pattern
  }
};

/**
 * Test a sound (for settings UI)
 */
export const testSound = (type: 'success' | 'error' | 'warning' | 'batch'): void => {
  switch (type) {
    case 'success':
      playSuccess();
      break;
    case 'error':
      playError();
      break;
    case 'warning':
      playWarning();
      break;
    case 'batch':
      playBatchApproved();
      break;
  }
};

