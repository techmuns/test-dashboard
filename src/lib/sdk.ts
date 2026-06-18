// Munshot Dashboard SDK client wrapper.
//
// The SDK is loaded as a browser bundle via the <script> tag in index.html and
// exposed on window.MunshotDashboardSDK. This module initializes a single
// dashboard-side client and exports it for the rest of the app.

export interface DashboardClientSdk {
  ready(): void;
  requestContext(): Promise<any>;
  publish(topic: string, data: unknown, metadata?: unknown): void;
  request(topic: string, data?: unknown, options?: unknown): Promise<any>;
  onTopic(topic: string, handler: (payload: any, meta?: any) => void): () => void;
  onRequest(
    topic: string,
    handler: (payload: any, meta?: any) => unknown | Promise<unknown>,
  ): () => void;
  onMessage(handler: (message: any) => void): () => void;
  sendError(error: unknown, metadata?: unknown): void;
}

declare global {
  interface Window {
    MunshotDashboardSDK?: {
      createDashboardClientSdk(config: {
        dashboardId: string;
        dashboardName: string;
      }): DashboardClientSdk;
    };
  }
}

export const DASHBOARD_ID = "chat-web-reader";
export const DASHBOARD_NAME = "Chat + Web Reader";

// No-op fallback so the dashboard still renders if the SDK script fails to load
// (e.g. during local development outside the Munshot host).
function createNoopSdk(): DashboardClientSdk {
  return {
    ready: () => {},
    requestContext: async () => null,
    publish: () => {},
    request: async () => null,
    onTopic: () => () => {},
    onRequest: () => () => {},
    onMessage: () => () => {},
    sendError: () => {},
  };
}

function initSdk(): DashboardClientSdk {
  const factory = window.MunshotDashboardSDK?.createDashboardClientSdk;
  if (!factory) {
    console.warn(
      "[dashboard] MunshotDashboardSDK not found on window; using no-op SDK. " +
        "This is expected only outside the Munshot host iframe.",
    );
    return createNoopSdk();
  }
  return factory({ dashboardId: DASHBOARD_ID, dashboardName: DASHBOARD_NAME });
}

export const sdk: DashboardClientSdk = initSdk();
