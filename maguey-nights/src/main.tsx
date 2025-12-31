import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupErrorHandlers } from "./lib/errors";

// Initialize error tracking
setupErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);
