import { useEffect, useState } from "react";
import { sdk } from "../lib/sdk";

// Authoritative host-context hook. The Munshot host owns auth and market
// selection; dashboards consume them through the SDK. See auth-standards.md.

export interface SessionContext {
  token: string | null;
  userName: string | null;
  email: string | null;
  orgId: string | null;
  orgName: string | null;
}

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

  const applyContext = (ctx: any) => {
    if (!ctx) return;

    if (ctx.session) setSession({ ...EMPTY_SESSION, ...ctx.session });

    if (ctx.market) {
      setTicker(ctx.market.selectedTicker ?? null);
      setTickerCompany(ctx.market.selectedTickerCompany ?? null);
      setTickerCountry(ctx.market.selectedTickerCountry ?? null);
      setSelectedSymbol(ctx.market.selectedSymbol ?? null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      try {
        const ctx = await sdk.requestContext();
        if (!cancelled) applyContext(ctx);
      } catch (err) {
        console.warn("[dashboard] requestContext failed", err);
      }
    };

    sync();

    return sdk.onMessage((message: any) => {
      const payload = message?.payload ?? message;
      if (payload?.context) applyContext(payload.context);
      if (payload?.session || payload?.market) applyContext(payload);
    });
  }, []);

  return { session, ticker, tickerCompany, tickerCountry, selectedSymbol };
}
