// Ticket validation and sanitization utilities

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Validates and sanitizes a ticket ID
 */
export const validateTicketId = (ticketId: string): ValidationResult => {
  if (!ticketId || typeof ticketId !== 'string') {
    return {
      isValid: false,
      error: "Ticket ID is required",
    };
  }

  // Sanitize: trim whitespace and convert to uppercase
  const sanitized = ticketId.trim().toUpperCase();

  if (sanitized.length === 0) {
    return {
      isValid: false,
      error: "Ticket ID cannot be empty",
    };
  }

  // Check minimum length
  if (sanitized.length < 3) {
    return {
      isValid: false,
      error: "Ticket ID must be at least 3 characters",
    };
  }

  // Check maximum length
  if (sanitized.length > 50) {
    return {
      isValid: false,
      error: "Ticket ID must be less than 50 characters",
    };
  }

  // Optional: Validate format (e.g., MGY-2025-001)
  // Allow alphanumeric, hyphens, underscores
  const validPattern = /^[A-Z0-9\-_]+$/;
  if (!validPattern.test(sanitized)) {
    return {
      isValid: false,
      error: "Ticket ID contains invalid characters. Only letters, numbers, hyphens, and underscores are allowed",
    };
  }

  return {
    isValid: true,
    sanitized,
  };
};

/**
 * Sanitizes ticket ID (always returns sanitized version, even if invalid)
 */
export const sanitizeTicketId = (ticketId: string): string => {
  if (!ticketId || typeof ticketId !== 'string') {
    return '';
  }
  return ticketId.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
};

