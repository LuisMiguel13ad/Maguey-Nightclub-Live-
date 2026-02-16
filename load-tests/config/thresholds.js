// Shared threshold definitions for all k6 load tests
// Based on CONTEXT.md: p95 < 500ms default, scenario-specific overrides

export const thresholds = {
  // Global thresholds (from CONTEXT.md)
  http_req_duration: ['p(95)<500'],  // p95 < 500ms
  http_req_failed: ['rate<0.01'],    // Error rate < 1%
  checks: ['rate>0.95'],             // 95% of checks must pass
};

// Scenario-specific threshold overrides
export const scenarioThresholds = {
  purchase: {
    'http_req_duration{scenario:purchase}': ['p(95)<500'],
    'http_req_failed{scenario:purchase}': ['rate<0.01'],
  },
  scanner: {
    'http_req_duration{scenario:scanner}': ['p(95)<200'],  // Scanner must be faster
    'http_req_failed{scenario:scanner}': ['rate<0.001'],   // Near-zero errors
  },
  dashboard: {
    'http_req_duration{scenario:dashboard}': ['p(95)<3000'],  // Dashboard < 3s
    'http_req_failed{scenario:dashboard}': ['rate<0.01'],
  },
  webhook: {
    'http_req_duration{scenario:webhook}': ['p(95)<1000'],  // Webhooks allow 1s
    'http_req_failed{scenario:webhook}': ['rate<0.01'],
  },
};

// Merge base thresholds with scenario-specific
export function getThresholds(scenario) {
  return {
    ...thresholds,
    ...(scenarioThresholds[scenario] || {}),
  };
}
