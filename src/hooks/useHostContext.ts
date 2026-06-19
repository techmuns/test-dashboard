import { useEffect, useState } from "react";
import { sdk, type SessionContext } from "../lib/sdk";

// Authoritative host-context hook (matches the Munshot host contract).
//
// The host owns auth and market selection and pushes them to the dashboard.
// The SDK caches the latest context internally; we read it with
// sdk.getContext() and re-sync on every host message. The handshake itself
// (sdk.ready()) is initiated once at app startup, not here.

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
    const sync = () => {
      const ctx = sdk.getContext();
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

    // Read whatever the SDK already cached, then re-sync on every host message.
    sync();
    return sdk.onMessage(sync);
  }, []);

  return { session, ticker, tickerCompany, tickerCountry, selectedSymbol };
}
