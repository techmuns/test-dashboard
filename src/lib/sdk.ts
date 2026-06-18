/**
 * Munshot Dashboard SDK wrapper.
 *
 * The SDK is loaded globally from the script tag in index.html. This module is
 * the single integration point the rest of the dashboard talks to, so widgets
 * never touch the global or raw postMessage directly (per auth-standards.md).
 *
 * The exact shape of the global differs slightly across SDK builds, so we adapt
 * defensively: if the SDK is missing (e.g. the dashboard is opened outside the
 * Munshot host), the wrapper degrades gracefully and the UI shows its
 * "Waiting for session..." states instead of crashing.
 */

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

export interface HostContext {
  session?: Partial<SessionContext>;
  market?: Partial<MarketContext>;
  [key: string]: unknown;
}

type MessageListener = () => void;
type RequestHandler = (payload: unknown) => Promise<unknown> | unknown;

/** Loosely-typed view of whatever the global SDK exposes. */
interface RawMunshotClient {
  ready?: () => void;
  init?: (config?: unknown) => void;
  register?: (metadata: unknown) => void;
  registerDashboard?: (metadata: unknown) => void;
  requestContext?: () => void;
  getContext?: () => HostContext | null;
  on?: (event: string, cb: (msg: unknown) => void) => unknown;
  onMessage?: (cb: (msg: unknown) => void) => unknown;
  subscribe?: (topic: string, cb: (msg: unknown) => void) => unknown;
  onRequest?: (channel: string, handler: RequestHandler) => unknown;
  publish?: (topic: string, payload: unknown) => void;
  disconnect?: () => void;
}

interface MunshotGlobal {
  createClient?: (config: unknown) => RawMunshotClient;
  init?: (config: unknown) => RawMunshotClient;
  new (config: unknown): RawMunshotClient;
}

const DASHBOARD_METADATA = {
  id: "munshot-ask-the-web",
  name: "Ask the Web",
  version: "1.0.0",
};

function resolveGlobal(): MunshotGlobal | RawMunshotClient | null {
  const w = window as unknown as Record<string, unknown>;
  const candidates = [
    "MunshotDashboardSDK",
    "MunshotDashboard",
    "munshotDashboard",
    "MunshotSDK",
    "Munshot",
  ];
  for (const name of candidates) {
    if (w[name]) return w[name] as MunshotGlobal | RawMunshotClient;
  }
  return null;
}

function instantiate(g: MunshotGlobal | RawMunshotClient): RawMunshotClient {
  // The global may be a factory, a constructor, or an already-built client.
  const anyG = g as unknown as MunshotGlobal;
  try {
    if (typeof anyG.createClient === "function") {
      return anyG.createClient(DASHBOARD_METADATA);
    }
    if (typeof anyG.init === "function") {
      const maybe = anyG.init(DASHBOARD_METADATA);
      if (maybe && typeof maybe === "object") return maybe;
    }
    if (typeof g === "function") {
      return new (g as MunshotGlobal)(DASHBOARD_METADATA);
    }
  } catch {
    // fall through to treating it as a ready-made client
  }
  return g as RawMunshotClient;
}

class MunshotSdk {
  private client: RawMunshotClient | null = null;
  private context: HostContext | null = null;
  private listeners = new Set<MessageListener>();
  private requestHandlers = new Map<string, RequestHandler>();
  private started = false;

  /** Documented SDK lifecycle: init, register, ready, request + subscribe. */
  start(): void {
    if (this.started) return;
    this.started = true;

    const g = resolveGlobal();
    if (!g) {
      console.warn(
        "[Munshot SDK] Global SDK not found. Running in degraded mode; " +
          "host context and exports are unavailable.",
      );
      return;
    }

    try {
      this.client = instantiate(g);
      const c = this.client;

      c.init?.(DASHBOARD_METADATA);
      (c.registerDashboard ?? c.register)?.(DASHBOARD_METADATA);

      const onAny = (raw: unknown) => this.handleIncoming(raw);
      // Subscribe to host context updates via whichever channel exists.
      c.on?.("host:init", onAny);
      c.on?.("host:context:update", onAny);
      c.on?.("context", onAny);
      c.onMessage?.(onAny);
      c.subscribe?.("host:context:update", onAny);

      // Wire any request handlers registered before start (e.g. capture.visual).
      if (typeof c.onRequest === "function") {
        for (const [channel, handler] of this.requestHandlers) {
          c.onRequest(channel, handler);
        }
      }

      // Signal readiness, then ask for the initial context snapshot.
      c.ready?.();
      c.requestContext?.();
      this.handleIncoming(undefined); // pull any synchronous getContext() value
    } catch (err) {
      console.error("[Munshot SDK] Initialization failed:", err);
    }
  }

  private handleIncoming(raw: unknown): void {
    let next: HostContext | null = null;

    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      // Messages may wrap context in { context } / { payload } / { data }.
      next =
        (obj.context as HostContext) ??
        (obj.payload as HostContext) ??
        (obj.data as HostContext) ??
        (obj as HostContext);
    }

    if (!next) {
      try {
        next = this.client?.getContext?.() ?? null;
      } catch {
        next = null;
      }
    }

    if (next) {
      this.context = { ...this.context, ...next };
      this.emit();
    }
  }

  private emit(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch (err) {
        console.error("[Munshot SDK] listener error:", err);
      }
    }
  }

  getContext(): HostContext | null {
    if (this.context) return this.context;
    try {
      return this.client?.getContext?.() ?? null;
    } catch {
      return null;
    }
  }

  /** Subscribe to context changes. Returns an unsubscribe function. */
  onMessage(cb: MessageListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Register a host request handler (e.g. dashboard.capture.visual). */
  onRequest(channel: string, handler: RequestHandler): void {
    this.requestHandlers.set(channel, handler);
    if (this.client && typeof this.client.onRequest === "function") {
      this.client.onRequest(channel, handler);
    }
  }

  /** Publish a namespaced telemetry / interaction event. */
  publish(topic: string, payload: unknown): void {
    try {
      this.client?.publish?.(topic, payload);
    } catch (err) {
      console.error("[Munshot SDK] publish failed:", err);
    }
  }
}

export const sdk = new MunshotSdk();
