/**
 * Security Headers Tests
 * 
 * Tests for security headers functionality including:
 * - getSecurityHeaders() returns all required headers
 * - CSP includes Stripe domains
 * - X-Frame-Options is set to DENY
 * - HSTS is configured correctly
 */

import { describe, it, expect } from 'vitest';
import {
  getSecurityHeaders,
  securityHeaders,
  buildCSP,
  type SecurityHeadersConfig,
} from '../security-headers';

describe('Security Headers', () => {
  describe('getSecurityHeaders()', () => {
    it('should return all required headers with default configuration', () => {
      const headers = getSecurityHeaders();

      // Check all required headers are present
      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).toHaveProperty('X-Frame-Options');
      expect(headers).toHaveProperty('X-Content-Type-Options');
      expect(headers).toHaveProperty('Referrer-Policy');
      expect(headers).toHaveProperty('Permissions-Policy');
      expect(headers).toHaveProperty('Strict-Transport-Security');
      expect(headers).toHaveProperty('X-XSS-Protection');
      expect(headers).toHaveProperty('Cross-Origin-Embedder-Policy');
      expect(headers).toHaveProperty('Cross-Origin-Opener-Policy');
      expect(headers).toHaveProperty('Cross-Origin-Resource-Policy');
    });

    it('should use custom configuration when provided', () => {
      const customConfig: SecurityHeadersConfig = {
        xFrameOptions: 'SAMEORIGIN',
        contentSecurityPolicy: "default-src 'self' https://example.com",
      };

      const headers = getSecurityHeaders(customConfig);

      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
      expect(headers['Content-Security-Policy']).toContain('https://example.com');
    });

    it('should use defaults for unspecified configuration options', () => {
      const partialConfig: SecurityHeadersConfig = {
        xFrameOptions: 'SAMEORIGIN',
      };

      const headers = getSecurityHeaders(partialConfig);

      // Custom option should be used
      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');

      // Other options should use defaults
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Pre-configured securityHeaders (pass-lounge)', () => {
    it('should include all required headers', () => {
      expect(securityHeaders).toHaveProperty('Content-Security-Policy');
      expect(securityHeaders).toHaveProperty('X-Frame-Options');
      expect(securityHeaders).toHaveProperty('X-Content-Type-Options');
      expect(securityHeaders).toHaveProperty('Referrer-Policy');
      expect(securityHeaders).toHaveProperty('Permissions-Policy');
      expect(securityHeaders).toHaveProperty('Strict-Transport-Security');
      expect(securityHeaders).toHaveProperty('X-XSS-Protection');
      expect(securityHeaders).toHaveProperty('Cross-Origin-Embedder-Policy');
      expect(securityHeaders).toHaveProperty('Cross-Origin-Opener-Policy');
      expect(securityHeaders).toHaveProperty('Cross-Origin-Resource-Policy');
    });

    it('should have X-Frame-Options set to DENY', () => {
      expect(securityHeaders['X-Frame-Options']).toBe('DENY');
    });

    it('should have HSTS configured correctly', () => {
      const hsts = securityHeaders['Strict-Transport-Security'];
      
      expect(hsts).toBeDefined();
      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    });

    it('should include Stripe domains in CSP', () => {
      const csp = securityHeaders['Content-Security-Policy'];

      // Check script-src includes Stripe
      expect(csp).toContain('https://js.stripe.com');
      expect(csp).toContain('https://*.stripe.com');

      // Check frame-src includes Stripe
      expect(csp).toContain('frame-src');
      expect(csp).toMatch(/frame-src[^;]*https:\/\/js\.stripe\.com/);
      expect(csp).toMatch(/frame-src[^;]*https:\/\/hooks\.stripe\.com/);

      // Check connect-src includes Stripe
      expect(csp).toMatch(/connect-src[^;]*https:\/\/api\.stripe\.com/);
      expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.stripe\.com/);
    });

    it('should have proper CSP structure', () => {
      const csp = securityHeaders['Content-Security-Policy'];

      // Should include essential directives
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src");
      expect(csp).toContain("frame-src");
      expect(csp).toContain("connect-src");
      expect(csp).toContain("img-src");
      expect(csp).toContain("style-src");
      expect(csp).toContain("font-src");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("upgrade-insecure-requests");
    });

    it('should have X-Content-Type-Options set to nosniff', () => {
      expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should have X-XSS-Protection set correctly', () => {
      expect(securityHeaders['X-XSS-Protection']).toBe('1; mode=block');
    });

    it('should have proper Referrer-Policy', () => {
      expect(securityHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should have Permissions-Policy with Stripe payment support', () => {
      const permissionsPolicy = securityHeaders['Permissions-Policy'];
      
      expect(permissionsPolicy).toBeDefined();
      expect(permissionsPolicy).toContain('payment=(self "https://js.stripe.com")');
    });

    it('should have proper Cross-Origin policies', () => {
      expect(securityHeaders['Cross-Origin-Embedder-Policy']).toBe('require-corp');
      expect(securityHeaders['Cross-Origin-Opener-Policy']).toBe('same-origin');
      expect(securityHeaders['Cross-Origin-Resource-Policy']).toBe('same-origin');
    });
  });

  describe('buildCSP()', () => {
    it('should build CSP string from directives', () => {
      const directives = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://example.com"],
        imgSrc: ["'self'", "data:", "https:"],
      };

      const csp = buildCSP(directives);

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' https://example.com");
      expect(csp).toContain("img-src 'self' data: https:");
    });

    it('should handle camelCase to kebab-case conversion', () => {
      const directives = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
      };

      const csp = buildCSP(directives);

      expect(csp).toContain('default-src');
      expect(csp).toContain('script-src');
    });
  });
});
