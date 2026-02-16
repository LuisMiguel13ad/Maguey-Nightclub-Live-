import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary, setupErrorTracking } from "./lib/errors/index";
import { initSentry } from "./lib/sentry";

// Initialize Sentry first (before any errors can occur)
initSentry();

// Initialize error tracking
setupErrorTracking();

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error('Root element not found');
  document.body.innerHTML = '<h1 style="color: red; padding: 2rem;">Error: Root element not found</h1>';
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <ErrorBoundary level="page">
        <App />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('Failed to render app:', error);
    rootElement.innerHTML = `
      <div style="padding: 2rem; font-family: sans-serif;">
        <h1 style="color: red;">Error Loading Application</h1>
        <p>${error instanceof Error ? error.message : String(error)}</p>
        <p>Please check the browser console for more details.</p>
      </div>
    `;
  }
}
