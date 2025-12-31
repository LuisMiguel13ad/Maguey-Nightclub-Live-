/**
 * Purchase Site Configuration Utility
 * 
 * Centralized configuration for generating purchase site URLs.
 * Uses environment variables with fallback support for backward compatibility.
 */

/**
 * Get the base URL for the purchase site
 * Priority: VITE_PURCHASE_SITE_URL > VITE_PURCHASE_WEBSITE_URL > localhost (dev) > production URL
 */
export const getPurchaseSiteBaseUrl = (): string => {
  // Primary: explicitly configured URL
  const primaryUrl = import.meta.env.VITE_PURCHASE_SITE_URL;
  if (primaryUrl && primaryUrl.trim() !== '') {
    return primaryUrl.trim();
  }

  // Fallback: alternative env variable
  const fallbackUrl = import.meta.env.VITE_PURCHASE_WEBSITE_URL;
  if (fallbackUrl && fallbackUrl.trim() !== '') {
    return fallbackUrl.trim();
  }

  // Development: check if we're in dev mode (localhost)
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
  if (isDevelopment) {
    return 'http://localhost:3016';
  }

  // Production default
  return 'https://tickets.maguey.club';
};

/**
 * Generate a purchase URL for a specific event
 * @param eventId - The event ID (UUID) from Supabase
 * @param eventName - Optional event name to include as a query parameter
 * @returns The full URL to the event on the purchase site, or empty string if not configured
 * @deprecated Use getCheckoutUrlForEvent instead for direct checkout links
 */
export const getPurchaseEventUrl = (eventId: string, eventName?: string): string => {
  if (!eventId) {
    return '';
  }

  const baseUrl = getPurchaseSiteBaseUrl();
  if (!baseUrl) {
    return '';
  }

  // Remove trailing slash from base URL if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  // Build base URL with event ID
  let url = `${cleanBaseUrl}/event/${eventId}`;
  
  // Add event name as query parameter if provided
  if (eventName && eventName.trim() !== '') {
    const encodedName = encodeURIComponent(eventName.trim());
    url += `?name=${encodedName}`;
  }
  
  return url;
};

/**
 * Fetch the default ticket ID for an event from the purchase site
 * @param eventId - The event ID (UUID) from Supabase
 * @returns The default ticket ID, or null if not found
 */
export const getDefaultTicketIdForEvent = async (eventId: string): Promise<string | null> => {
  if (!eventId) {
    return null;
  }

  const baseUrl = getPurchaseSiteBaseUrl();
  if (!baseUrl) {
    return null;
  }

  try {
    // Call the purchase site's API to get the default ticket
    // We'll use a fetch to the purchase site's events service
    const response = await fetch(`${baseUrl}/api/events/${eventId}/default-ticket`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.ticketId || null;
    }
  } catch (error) {
    console.error('Error fetching default ticket:', error);
  }

  return null;
};

/**
 * Generate a checkout URL for a specific event with ticket
 * @param eventId - The event ID (UUID) from Supabase
 * @param ticketId - The ticket ID (UUID) from Supabase
 * @returns The full URL to checkout on the purchase site
 */
export const getCheckoutUrl = (eventId: string, ticketId: string): string => {
  if (!eventId || !ticketId) {
    return '';
  }

  const baseUrl = getPurchaseSiteBaseUrl();
  if (!baseUrl) {
    return '';
  }

  // Remove trailing slash from base URL if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  return `${cleanBaseUrl}/checkout?event=${eventId}&ticket=${ticketId}`;
};

/**
 * Generate checkout URL for an event (will auto-select default ticket on purchase site)
 * @param eventId - The event ID (UUID) from Supabase
 * @returns The checkout URL (purchase site will handle selecting default ticket)
 */
export const getCheckoutUrlForEvent = (eventId: string): string => {
  if (!eventId) {
    return '';
  }

  const baseUrl = getPurchaseSiteBaseUrl();
  if (!baseUrl) {
    return '';
  }

  // Remove trailing slash from base URL if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  // Redirect to checkout with event ID - the checkout page will handle selecting default ticket
  return `${cleanBaseUrl}/checkout?event=${eventId}`;
};

/**
 * Generate a waitlist URL for a sold-out event
 * @param eventId - The event ID (UUID) from Supabase
 * @param eventName - Optional event name to include as a query parameter
 * @returns The full URL to the waitlist on the purchase site, or empty string if not configured
 */
export const getWaitlistUrl = (eventId: string, eventName?: string): string => {
  if (!eventId) {
    return '';
  }

  const baseUrl = getPurchaseSiteBaseUrl();
  if (!baseUrl) {
    return '';
  }

  // Remove trailing slash from base URL if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  // Build base URL with event ID and waitlist parameter
  let url = `${cleanBaseUrl}/event/${eventId}?waitlist=true`;
  
  // Add event name as query parameter if provided
  if (eventName && eventName.trim() !== '') {
    const encodedName = encodeURIComponent(eventName.trim());
    url += `&name=${encodedName}`;
  }
  
  return url;
};
