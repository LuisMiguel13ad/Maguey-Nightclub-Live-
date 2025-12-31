import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary";

// Initialize error tracking (with error handling to prevent app crash)
setTimeout(() => {
  import("./lib/errors").then(({ setupErrorTracking }) => {
    setupErrorTracking();
  }).catch(() => {
    // Error tracking setup failed (non-critical)
  });
}, 0);

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error('Root element not found');
  document.body.innerHTML = '<h1 style="color: red; padding: 2rem;">Error: Root element not found</h1>';
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error("Failed to render app:", error);
    rootElement.innerHTML = `
      <div style="padding: 2rem; font-family: sans-serif; background: #000; color: #fff; min-height: 100vh;">
        <h1 style="color: #ff6b6b;">Error Loading Application</h1>
        <p style="color: #ff6b6b;">${error instanceof Error ? error.message : String(error)}</p>
        <p style="color: #888;">Please check the browser console (F12) for more details.</p>
      </div>
    `;
  }
}
