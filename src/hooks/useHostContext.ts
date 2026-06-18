import { useEffect, useState } from "react";
import { sdk, type SessionContext } from "../lib/sdk";

/**
 * Authoritative access point for host-provided context (auth-standards.md).
 * Widgets read session token and market selection from here only; they never
 * touch the SDK global directly.
 */
export function useHostContext() {
  const [session, setSession] = useState<SessionContext>({
    token: null,
    userName: null,
    email: null,
    orgId: null,
    orgName: null,
  });
  const [ticker, setTicker] = useState<string | null>(null);
  const [tickerCompany, setTickerCompany] = useState<string | null>(null);
  const [tickerCountry, setTickerCountry] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const sync = () => {
    const ctx = sdk.getContext();
    if (!ctx) return;

    if (ctx.session) {
      setSession({
        token: ctx.session.token ?? null,
        userName: ctx.session.userName ?? null,
        email: ctx.session.email ?? null,
        orgId: ctx.session.orgId ?? null,
        orgName: ctx.session.orgName ?? null,
      });
    }

    if (ctx.market) {
      setTicker(ctx.market.selectedTicker ?? null);
      setTickerCompany(ctx.market.selectedTickerCompany ?? null);
      setTickerCountry(ctx.market.selectedTickerCountry ?? null);
      setSelectedSymbol(ctx.market.selectedSymbol ?? null);
    }
  };

  useEffect(() => {
    sync();
    return sdk.onMessage(sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { session, ticker, tickerCompany, tickerCountry, selectedSymbol };
}
