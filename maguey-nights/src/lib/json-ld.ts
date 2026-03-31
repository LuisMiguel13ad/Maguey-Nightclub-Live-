import { useEffect, useRef, useMemo } from 'react';
import type { EventDisplay, EventAvailability } from '@/services/eventService';

// Shared venue constant — reused across all schemas
export const MAGUEY_VENUE = {
  '@type': 'Place' as const,
  name: 'Maguey Delaware',
  address: {
    '@type': 'PostalAddress' as const,
    streetAddress: '3320 Old Capitol Trail',
    addressLocality: 'Wilmington',
    addressRegion: 'DE',
    postalCode: '19808',
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates' as const,
    latitude: 39.7447,
    longitude: -75.6243,
  },
};

const MAGUEY_ORGANIZER = {
  '@type': 'Organization' as const,
  name: 'Maguey Nightclub',
  url: 'https://magueynightclub.com',
};

/**
 * React hook that injects a JSON-LD script tag into document.head.
 * Updates on schema change, removes on unmount.
 */
export function useJsonLd(schema: Record<string, unknown> | null, id: string): void {
  const prevJsonRef = useRef<string>('');

  useEffect(() => {
    if (!schema) {
      // Remove existing script if schema becomes null
      const existing = document.getElementById(id);
      if (existing) existing.remove();
      prevJsonRef.current = '';
      return;
    }

    const json = JSON.stringify(schema);
    if (json === prevJsonRef.current) return;
    prevJsonRef.current = json;

    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = json;

    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
      prevJsonRef.current = '';
    };
  }, [schema, id]);
}

/**
 * Build Event schema for a single event page.
 */
export function buildEventSchema(
  event: EventDisplay,
  purchaseUrl: string,
  availability?: EventAvailability | null
): Record<string, unknown> {
  const totalAvailable = availability?.ticketTypes.reduce((sum, tt) => sum + tt.available, 0) ?? 0;
  const isSoldOut = availability ? totalAvailable === 0 : false;

  // Build ISO 8601 startDate from eventDate + eventTime
  let startDate = event.eventDate;
  if (event.eventTime && event.eventTime !== 'TBD') {
    startDate = `${event.eventDate}T${event.eventTime}`;
  }

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.artist,
    startDate,
    location: MAGUEY_VENUE,
    organizer: MAGUEY_ORGANIZER,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
  };

  if (event.description) {
    schema.description = event.description;
  }

  if (event.image && event.image !== '/placeholder.svg') {
    schema.image = event.image;
  }

  if (event.tags && event.tags.length > 0) {
    schema.keywords = event.tags.join(', ');
  }

  if (purchaseUrl) {
    schema.offers = {
      '@type': 'Offer',
      url: purchaseUrl,
      availability: isSoldOut
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      priceCurrency: 'USD',
    };
  }

  return schema;
}

/**
 * Build ItemList schema for the upcoming events listing page.
 */
export function buildEventListSchema(
  events: EventDisplay[],
  siteBaseUrl: string
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Upcoming Events at Maguey Nightclub',
    numberOfItems: events.length,
    itemListElement: events.map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${siteBaseUrl}/event/${event.id}`,
      name: event.artist,
    })),
  };
}

/**
 * Build Menu schema with sections and items.
 */
export function buildMenuSchema(
  menuItems: { name: string; description: string; price: number; category: string; salePrice?: number }[],
  menuCategories: { id: string; name: string }[]
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: 'Maguey Delaware Restaurant Menu',
    hasMenuSection: menuCategories.map((category) => {
      const items = menuItems.filter((item) => item.category === category.id);
      // Strip emoji prefix from category name for schema
      const cleanName = category.name.replace(/^\S+\s/, '');
      return {
        '@type': 'MenuSection',
        name: cleanName,
        hasMenuItem: items.map((item) => ({
          '@type': 'MenuItem',
          name: item.name,
          description: item.description,
          offers: {
            '@type': 'Offer',
            price: (item.salePrice || item.price).toFixed(2),
            priceCurrency: 'USD',
          },
        })),
      };
    }),
  };
}

/**
 * Build FAQPage schema from Q&A pairs.
 */
export function buildFAQSchema(
  faqItems: { question: string; answer: string }[]
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

/**
 * Hook wrapper that memoizes the schema to avoid unnecessary re-renders.
 * Use this for static schemas that don't depend on dynamic data.
 */
export function useStaticJsonLd(buildSchema: () => Record<string, unknown>, id: string): void {
  const schema = useMemo(buildSchema, []);
  useJsonLd(schema, id);
}
