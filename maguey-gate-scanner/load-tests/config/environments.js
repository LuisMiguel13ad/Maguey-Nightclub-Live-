/**
 * Environment Configuration
 * 
 * Defines base URLs and configuration for different environments
 */

export const environments = {
  local: {
    baseUrl: 'http://localhost:3015',
    apiUrl: 'http://localhost:3015/api',
    supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key',
    scannerApiUrl: 'http://localhost:3015/api/scan',
  },
  staging: {
    baseUrl: 'https://staging.maguey-scanner.com',
    apiUrl: 'https://staging.maguey-scanner.com/api',
    supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://your-staging-project.supabase.co',
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key',
    scannerApiUrl: 'https://staging.maguey-scanner.com/api/scan',
  },
  production: {
    baseUrl: 'https://scanner.maguey.com',
    apiUrl: 'https://scanner.maguey.com/api',
    supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://your-prod-project.supabase.co',
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key',
    scannerApiUrl: 'https://scanner.maguey.com/api/scan',
  },
};

/**
 * Get configuration for current environment
 */
export function getConfig() {
  const env = __ENV.ENVIRONMENT || 'local';
  const config = environments[env];
  
  if (!config) {
    throw new Error(`Unknown environment: ${env}. Use: local, staging, or production`);
  }
  
  return config;
}

/**
 * Get Supabase API endpoint
 */
export function getSupabaseUrl(config) {
  return `${config.supabaseUrl}/rest/v1`;
}

/**
 * Get Supabase headers
 */
export function getSupabaseHeaders(config) {
  return {
    'apikey': config.supabaseAnonKey,
    'Authorization': `Bearer ${config.supabaseAnonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

/**
 * Get scanner API headers
 */
export function getScannerHeaders(config, scannerId = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (scannerId) {
    headers['X-Scanner-Id'] = scannerId;
  }
  
  return headers;
}
