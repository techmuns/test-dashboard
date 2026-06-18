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

// Defensively normalize the real SDK client. The live browser bundle may not
// match the documented method signatures exactly: some methods (e.g.
// requestContext / request) may return undefined instead of a Promise, and
// subscription methods may not return an unsubscribe function. We wrap every
// method so callers can always `await`, `.catch`, and call the returned
// unsubscribe safely without crashing the dashboard.
function normalizeSdk(raw: any): DashboardClientSdk {
  const fn = (name: string): ((...args: any[]) => any) | null =>
    typeof raw?.[name] === "function" ? raw[name].bind(raw) : null;

  const ready = fn("ready");
  const requestContext = fn("requestContext");
  const publish = fn("publish");
  const request = fn("request");
  const onTopic = fn("onTopic");
  const onRequest = fn("onRequest");
  const onMessage = fn("onMessage");
  const sendError = fn("sendError");

  const toUnsub = (r: unknown): (() => void) =>
    typeof r === "function" ? (r as () => void) : () => {};

  const toPromise = (r: unknown): Promise<any> =>
    r && typeof (r as any).then === "function"
      ? (r as Promise<any>)
      : Promise.resolve(r ?? null);

  const safeVoid = (target: ((...a: any[]) => any) | null, label: string) =>
    (...args: any[]) => {
      try {
        target?.(...args);
      } catch (err) {
        console.warn(`[dashboard] sdk.${label} failed`, err);
      }
    };

  const safeSub = (target: ((...a: any[]) => any) | null, label: string) =>
    (...args: any[]): (() => void) => {
      try {
        return toUnsub(target?.(...args));
      } catch (err) {
        console.warn(`[dashboard] sdk.${label} failed`, err);
        return () => {};
      }
    };

  return {
    ready: safeVoid(ready, "ready"),
    requestContext: () => {
      try {
        return toPromise(requestContext?.());
      } catch (err) {
        return Promise.reject(err);
      }
    },
    publish: safeVoid(publish, "publish"),
    request: (topic: string, data?: unknown, options?: unknown) => {
      try {
        return toPromise(request?.(topic, data, options));
      } catch (err) {
        return Promise.reject(err);
      }
    },
    onTopic: safeSub(onTopic, "onTopic"),
    onRequest: safeSub(onRequest, "onRequest"),
    onMessage: safeSub(onMessage, "onMessage"),
    sendError: safeVoid(sendError, "sendError"),
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
  try {
    const client = factory({
      dashboardId: DASHBOARD_ID,
      dashboardName: DASHBOARD_NAME,
    });
    return normalizeSdk(client);
  } catch (err) {
    console.warn(
      "[dashboard] Failed to initialize MunshotDashboardSDK; using no-op SDK.",
      err,
    );
    return createNoopSdk();
  }
}

export const sdk: DashboardClientSdk = initSdk();
