/**
 * Marketing Site URL Configuration
 *
 * Used to generate share links that point to the public marketing site
 * (magueynightclub.com) rather than the purchase site (tickets.magueynightclub.com).
 */

const getMarketingSiteBaseUrl = (): string => {
  const configured = import.meta.env.VITE_MARKETING_SITE_URL;
  if (configured && configured.trim() !== "") {
    return configured.trim().replace(/\/$/, "");
  }

  const isDevelopment =
    import.meta.env.DEV || window.location.hostname === "localhost";
  if (isDevelopment) {
    return "http://localhost:3017";
  }

  return "https://magueynightclub.com";
};

export const MARKETING_SITE_URL = getMarketingSiteBaseUrl();

export function getMarketingEventUrl(eventId: string): string {
  return `${MARKETING_SITE_URL}/event/${eventId}`;
}
