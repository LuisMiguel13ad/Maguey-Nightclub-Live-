import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";
import { setupErrorHandlers } from "./lib/errors";

// Initialize Sentry first (before any errors can occur)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE || 'development',
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    beforeSend(event, hint) {
      const error = hint.originalException;
      // Filter out noisy errors
      if (error instanceof Error) {
        if (error.message?.includes('ResizeObserver')) return null;
        if (error.message?.includes('blocked:mixed-content')) return null;
      }
      return event;
    },
  });
  console.log('[Sentry] Initialized');
}

// Initialize error tracking
setupErrorHandlers();

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error('Root element not found');
  document.body.innerHTML = '<h1 style="color: red; padding: 2rem;">Error: Root element not found</h1>';
} else {
  try {
    createRoot(rootElement).render(
      <Sentry.ErrorBoundary fallback={
        <div style={{padding: '2rem', fontFamily: 'sans-serif', background: '#000', color: '#fff', minHeight: '100vh', textAlign: 'center'}}>
          <h1 style={{color: '#ff6b6b'}}>Something went wrong</h1>
          <p style={{color: '#888'}}>We encountered an error. Please refresh the page.</p>
          <button
            onClick={() => window.location.reload()}
            style={{padding: '0.5rem 1rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem'}}
          >
            Reload Page
          </button>
        </div>
      }>
        <App />
      </Sentry.ErrorBoundary>
    );
  } catch (error) {
    console.error("Failed to render app:", error);
    if (sentryDsn) {
      Sentry.captureException(error);
    }
    rootElement.innerHTML = `
      <div style="padding: 2rem; font-family: sans-serif; background: #000; color: #fff; min-height: 100vh; text-align: center;">
        <h1 style="color: #ff6b6b;">Error Loading Application</h1>
        <p style="color: #888;">Please refresh the page or try again later.</p>
      </div>
    `;
  }
}
