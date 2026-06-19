import { useEffect, useState } from "react";
import {
  sdk,
  type DashboardHostContext,
  type SessionContext,
} from "../lib/sdk";

// Authoritative host-context hook. The Munshot host owns auth and market
// selection; dashboards consume them through the SDK.
//
// Correct flow against the real SDK:
//   1. Read any context the SDK already cached from `host:init` (it may have
//      arrived before React mounted) via sdk.getContext().
//   2. Subscribe to the message channel and apply context from
//      `host:init` / `host:context:update` envelopes (payload.context).
//   3. Nudge the host to (re)send context with requestContext() — fire and
//      forget; it returns a boolean and no-ops until the channel exists.

const EMPTY_SESSION: SessionContext = {
  token: null,
  userName: null,
  email: null,
  orgId: null,
  orgName: null,
};

export function useHostContext() {
  const [session, setSession] = useState<SessionContext>(EMPTY_SESSION);
  const [ticker, setTicker] = useState<string | null>(null);
  const [tickerCompany, setTickerCompany] = useState<string | null>(null);
  const [tickerCountry, setTickerCountry] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  useEffect(() => {
    const applyContext = (ctx: DashboardHostContext | null) => {
      if (!ctx) return;

      if (ctx.session) {
        setSession({ ...EMPTY_SESSION, ...ctx.session });
      }

      if (ctx.market) {
        setTicker(ctx.market.selectedTicker ?? null);
        setTickerCompany(ctx.market.selectedTickerCompany ?? null);
        setTickerCountry(ctx.market.selectedTickerCountry ?? null);
        setSelectedSymbol(ctx.market.selectedSymbol ?? null);
      }
    };

    // 1. Apply already-cached context.
    applyContext(sdk.getContext());

    // 2. React to context updates over the message channel.
    const unsubscribe = sdk.onMessage((envelope) => {
      if (envelope?.source !== "host") return;
      if (
        envelope.kind === "host:init" ||
        envelope.kind === "host:context:update"
      ) {
        const ctx = envelope.payload?.context as
          | DashboardHostContext
          | undefined;
        if (ctx) applyContext(ctx);
      }
    });

    // 3. Ask the host to (re)send context.
    sdk.requestContext();

    return unsubscribe;
  }, []);

  return { session, ticker, tickerCompany, tickerCountry, selectedSymbol };
}
