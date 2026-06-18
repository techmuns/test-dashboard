import { useEffect } from "react";
import { toBlob } from "html-to-image";
import { sdk } from "../lib/sdk";

/**
 * Registers the `dashboard.capture.visual` request handler. When the host asks
 * for a visual snapshot, capture Zone 2 (the scrollable main content area) and
 * return a native Blob at pixelRatio 2 (auth-standards.md).
 */
export function useVisualCapture() {
  useEffect(() => {
    sdk.onRequest("dashboard.capture.visual", async () => {
      const mainElement =
        document.querySelector("#dashboard-main") ||
        document.querySelector("[data-dashboard-capture-root='true']") ||
        document.querySelector("main");

      if (!mainElement) {
        throw new Error("Main content container not found for visual snapshot");
      }

      try {
        const imageBlob = await toBlob(mainElement as HTMLElement, {
          pixelRatio: 2,
        });
        if (!imageBlob) {
          throw new Error("Visual snapshot capture returned an empty Blob");
        }
        return {
          visualSnapshot: imageBlob,
          capturedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.error("Failed to capture visual snapshot:", err);
        throw new Error("Failed to capture visual snapshot");
      }
    });
  }, []);
}
