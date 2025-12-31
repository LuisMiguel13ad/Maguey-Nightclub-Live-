/**
 * Password Breach Check Service
 * Uses HaveIBeenPwned API with k-anonymity model for privacy
 * Only sends first 5 characters of SHA-1 hash to API
 */

/**
 * Check if a password has been found in data breaches
 * @param password - The password to check
 * @returns Object with breached status and count
 */
export async function checkPasswordBreach(
  password: string
): Promise<{ breached: boolean; count: number }> {
  try {
    // Generate SHA-1 hash of password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    // Extract prefix (first 5 characters) and suffix (remaining characters)
    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);

    // Query HaveIBeenPwned API with k-anonymity model
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Maguey-Pass-Lounge/1.0',
      },
    });

    if (!response.ok) {
      // If API is unavailable, return safe default (not breached)
      console.warn('HaveIBeenPwned API unavailable, skipping breach check');
      return { breached: false, count: 0 };
    }

    const text = await response.text();
    const hashes = text.split('\n');

    // Check if our hash suffix exists in the returned list
    for (const line of hashes) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix === suffix) {
        const count = parseInt(countStr.trim(), 10);
        return { breached: true, count };
      }
    }

    // Password not found in breaches
    return { breached: false, count: 0 };
  } catch (error) {
    // If any error occurs, return safe default
    console.error('Error checking password breach:', error);
    return { breached: false, count: 0 };
  }
}

/**
 * Get a user-friendly message about password breach status
 * @param breachResult - Result from checkPasswordBreach
 * @returns User-friendly message
 */
export function getBreachMessage(breachResult: { breached: boolean; count: number }): string {
  if (!breachResult.breached) {
    return '';
  }

  if (breachResult.count > 100000) {
    return 'This password has been found in over 100,000 data breaches. Please choose a different password.';
  } else if (breachResult.count > 10000) {
    return 'This password has been found in over 10,000 data breaches. Please choose a stronger password.';
  } else if (breachResult.count > 1000) {
    return 'This password has been found in over 1,000 data breaches. Consider using a different password.';
  } else {
    return `This password has been found in ${breachResult.count} data breach${breachResult.count > 1 ? 'es' : ''}. Consider using a different password.`;
  }
}

