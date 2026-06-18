import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { sdk } from "./lib/sdk";
import { DashboardAskWeb } from "./dashboard_ask_web";

// Initialize the Munshot Dashboard SDK lifecycle before rendering so queued
// host context is delivered as soon as the dashboard signals readiness.
sdk.start();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root not found");
}

createRoot(container).render(
  <StrictMode>
    <DashboardAskWeb />
  </StrictMode>,
);
