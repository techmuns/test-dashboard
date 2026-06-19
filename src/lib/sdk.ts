// Munshot Dashboard SDK client adapter.
//
// Typed against the ACTUAL shipped bundle
// (munshot-dashboard-sdk.v1.0.0.min.js), not the idealized docs. Verified
// behavior from the bundle source:
//
//   - The browser global exposes the module namespace. Loaded as a classic
//     <script> (our case) `window.MunshotDashboardSDK.createDashboardClientSdk`
//     is the factory. (Loaded as an ES module the same global is instead
//     `{ createClient, Client }` — we probe both names to be safe.)
//   - `getContext()` is SYNCHRONOUS and returns the latest cached context or
//     null. This is how you read session/market/app.
//   - `requestContext()` returns a BOOLEAN (whether the message was posted),
//     NOT a Promise and NOT the context. It only nudges the host to (re)send
//     context; it no-ops until the channel is established by `host:init`.
//   - `autoReady` defaults to true: the SDK auto-sends `dashboard:ready` when
//     it receives `host:init`, so a manual `ready()` call is not required.
//   - Context is delivered on the message channel via envelopes of kind
//     `host:init` / `host:context:update`, with the context at
//     `envelope.payload.context`.
//   - `onMessage/onTopic/onRequest` each return an unsubscribe function.

export const DASHBOARD_ID = "chat-web-reader";
export const DASHBOARD_NAME = "Chat + Web Reader";

export interface SessionContext {
  token: string | null;
  userName: string | null;
  email: string | null;
  orgId: string | null;
  orgName: string | null;
}

export interface MarketContext {
  selectedTicker: string | null;
  selectedTickerCompany: string | null;
  selectedTickerCountry: string | null;
  selectedSymbol: string | null;
}

export interface AppContext {
  route: string | null;
  query: string | null;
  viewMode: string | null;
  selectedCategory: string | null;
  searchQuery: string | null;
}

export interface DashboardHostContext {
  session?: SessionContext;
  market?: MarketContext;
  app?: AppContext;
}

export interface DashboardSdkEnvelope {
  namespace: string;
  version: string;
  channelId: string;
  source: "host" | "dashboard";
  kind: string;
  timestamp: number;
  requestId?: string;
  payload?: any;
}

export interface NormalizedTopic {
  topic: string;
  data: any;
  metadata?: any;
}

export interface TopicMeta {
  origin: string;
  topic: string;
  requestId?: string;
}

export interface RequestOptions {
  timeoutMs?: number;
  metadata?: unknown;
}

export interface DashboardClientSdk {
  getContext(): DashboardHostContext | null;
  getChannelId(): string | null;
  onMessage(
    handler: (envelope: DashboardSdkEnvelope, meta: { origin: string }) => void,
  ): () => void;
  onTopic(
    topic: string,
    handler: (
      topic: NormalizedTopic,
      meta: TopicMeta,
      envelope: DashboardSdkEnvelope,
    ) => void,
  ): () => void;
  onRequest(
    topic: string,
    handler: (
      topic: NormalizedTopic,
      meta: TopicMeta,
      envelope: DashboardSdkEnvelope,
    ) => unknown | Promise<unknown>,
  ): () => void;
  ready(): boolean;
  requestContext(): boolean;
  publish(topic: string, data?: unknown, metadata?: unknown): boolean;
  request(topic: string, data?: unknown, options?: RequestOptions): Promise<any>;
  sendError(message: string, code?: string, details?: unknown): boolean;
  destroy(): void;
}

export interface CreateClientConfig {
  dashboardId: string;
  dashboardName?: string;
  autoReady?: boolean;
  requestTimeoutMs?: number;
  maxPayloadBytes?: number;
  lockOriginOnFirstMessage?: boolean;
  allowedOrigins?: string[];
  targetWindow?: Window | null;
  targetOrigin?: string;
}

type SdkFactory = (config: CreateClientConfig) => DashboardClientSdk;
type SdkCtor = new (config: CreateClientConfig) => DashboardClientSdk;

declare global {
  interface Window {
    MunshotDashboardSDK?: {
      createDashboardClientSdk?: SdkFactory;
      createClient?: SdkFactory;
      DashboardClientSdk?: SdkCtor;
      Client?: SdkCtor;
    };
  }
}

// Faithful no-op used ONLY when the SDK script is absent (e.g. running the
// build standalone outside the Munshot host). Return types match the real
// client so callers behave identically.
function createNoopSdk(): DashboardClientSdk {
  return {
    getContext: () => null,
    getChannelId: () => null,
    onMessage: () => () => {},
    onTopic: () => () => {},
    onRequest: () => () => {},
    ready: () => false,
    requestContext: () => false,
    publish: () => false,
    request: async () => null,
    sendError: () => false,
    destroy: () => {},
  };
}

function initSdk(): DashboardClientSdk {
  const global = window.MunshotDashboardSDK;
  const config: CreateClientConfig = {
    dashboardId: DASHBOARD_ID,
    dashboardName: DASHBOARD_NAME,
  };

  const factory = global?.createDashboardClientSdk ?? global?.createClient;
  if (typeof factory === "function") {
    try {
      return factory(config);
    } catch (err) {
      console.error("[dashboard] createDashboardClientSdk failed", err);
    }
  }

  const Ctor = global?.DashboardClientSdk ?? global?.Client;
  if (typeof Ctor === "function") {
    try {
      return new Ctor(config);
    } catch (err) {
      console.error("[dashboard] new DashboardClientSdk failed", err);
    }
  }

  console.warn(
    "[dashboard] MunshotDashboardSDK not found on window; using no-op SDK. " +
      "Expected only when running outside the Munshot host iframe.",
  );
  return createNoopSdk();
}

// Single module-scoped client. The constructor attaches its window 'message'
// listener immediately, so the SDK can receive and cache `host:init` even
// before React mounts; the hook then reads it via getContext().
export const sdk: DashboardClientSdk = initSdk();
