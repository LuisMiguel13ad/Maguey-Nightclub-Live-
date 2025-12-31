/**
 * Utility functions for ticket type code generation and normalization
 */

/**
 * Generate a ticket type code from a name
 * Examples:
 * - "General Admission" -> "GA"
 * - "VIP" -> "VIP"
 * - "Early Bird" -> "EB"
 * - "Table for 4" -> "TF4"
 */
export function generateTicketTypeCode(ticketTypeName: string, index: number = 0): string {
  const trimmed = ticketTypeName.trim();
  if (!trimmed) {
    return `TT-${index + 1}`;
  }

  const words = trimmed.toUpperCase().split(/\s+/);
  
  let code = '';
  if (words.length === 1) {
    // Single word: take first 2-3 letters
    code = words[0].substring(0, Math.min(3, words[0].length));
  } else {
    // Multiple words: take first letter of each
    code = words.map(w => w[0]).join('');
  }
  
  // Remove any non-alphanumeric characters
  code = code.replace(/[^A-Z0-9]/g, '');
  
  // Ensure code is not empty
  if (!code) {
    code = `TT${index + 1}`;
  }
  
  // Add index suffix if needed (for uniqueness)
  if (index > 0) {
    code += `-${index + 1}`;
  }
  
  return code;
}

/**
 * Normalize ticket type name for comparison
 */
export function normalizeTicketTypeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Check if two ticket type names match (case-insensitive, normalized)
 */
export function ticketTypeNamesMatch(name1: string, name2: string): boolean {
  return normalizeTicketTypeName(name1) === normalizeTicketTypeName(name2);
}

