/**
 * Event Day-of-Week Validation Helper
 * 
 * Determines the required day of week for recurring events based on event name.
 * Returns null for custom events that don't match known patterns.
 */

/**
 * Get the required day of week for an event based on its name
 * @param eventName - The name of the event
 * @returns The required day of week (0 = Sunday, 5 = Friday, 6 = Saturday) or null if not a recurring event
 */
export const getRequiredDayOfWeek = (eventName: string): number | null => {
  if (!eventName) return null;
  
  const nameLower = eventName.toLowerCase().trim();
  
  // Reggaeton/Perreo Fridays - must be on Friday (5)
  if (
    (nameLower.includes('reggaeton') || nameLower.includes('perreo')) &&
    (nameLower.includes('friday') || nameLower.includes('fridays'))
  ) {
    return 5; // Friday
  }
  
  // Regional Mexicano - must be on Saturday (6)
  if (nameLower.includes('regional mexicano') || nameLower.includes('regional mexicano')) {
    return 6; // Saturday
  }
  
  // Cumbia - must be on Sunday (0)
  if (nameLower.includes('cumbia')) {
    return 0; // Sunday
  }
  
  // No match - allow flexibility for custom events
  return null;
};

/**
 * Get a human-readable day name from day of week number
 */
export const getDayName = (dayOfWeek: number): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || 'Unknown';
};

/**
 * Validate if an event date matches the required day of week
 * @param eventName - The name of the event
 * @param eventDate - The date of the event
 * @returns Object with isValid boolean and error message if invalid
 */
export const validateEventDayOfWeek = (
  eventName: string,
  eventDate: Date
): { isValid: boolean; errorMessage?: string } => {
  const requiredDay = getRequiredDayOfWeek(eventName);
  
  // If no required day, allow any day (custom events)
  if (requiredDay === null) {
    return { isValid: true };
  }
  
  const actualDay = eventDate.getDay();
  
  if (actualDay !== requiredDay) {
    const requiredDayName = getDayName(requiredDay);
    return {
      isValid: false,
      errorMessage: `${eventName} must be on a ${requiredDayName}. Please select a ${requiredDayName} date.`,
    };
  }
  
  return { isValid: true };
};

