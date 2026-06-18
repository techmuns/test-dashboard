# Munshot Chat + Web Reader Dashboard

An embedded Munshot dashboard built with the **dashboard-skill** standards. It
combines two registered datasources behind two input fields:

| Input field | Datasource | Service | Endpoint |
| ----------- | ---------- | ------- | -------- |
| **User query** | `muns_chat` (Chat API) | nestjs | `POST /chat/chat-muns` |
| **URL** | `web_reader` (Web Reader API) | fastapi | `POST /tools/web-reader` |

The query streams an AI answer from Muns Chat; the URL(s) are extracted by the
Web Reader. You can run them independently ("Ask" / "Read URL") or together
("Run both"). If a query is present when reading a URL, it is forwarded as the
Web Reader extraction `task`.

## Standards compliance

- **3-zone iframe shell**: sticky 48px header, single scrolling `#dashboard-main`
  capture target, sticky footer.
- **`WidgetCard`** for every data widget, in the standard Zone 2 order:
  inputs → KPIs → primary AI answer → insights → extraction detail → source trail.
- **Munshot Dashboard SDK** loaded via the official script tag; auth/ticker come
  from `useHostContext` (`context.session.token`, `context.market.selectedTicker`).
  No standalone auth, no hardcoded tokens or tickers.
- **Bearer auth** on every API call: `Authorization: Bearer ${session.token}`.
- **States**: shimmer loading, waiting-for-session, empty, partial (per-URL
  failed extraction), and friendly error states.
- **Provenance**: source trail with read URLs, extraction time, word counts, and
  chat/message IDs.
- **Visual export**: implements the `dashboard.capture.visual` SDK request using
  `html-to-image`, returning a native `Blob`.

## Development

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # typecheck + production build
```

Outside the Munshot host iframe the SDK falls back to a no-op client, so the
shell still renders; live API calls require a host-provided session token.

## Structure

```
src/
  dashboard_chat_web_reader.tsx   # main dashboard (Zone 2 layout + widgets)
  hooks/useHostContext.ts         # authoritative host context (session, ticker)
  lib/sdk.ts                      # Munshot Dashboard SDK client
  lib/datasources.ts              # muns_chat + web_reader API calls
  lib/web_reader_format.ts        # defensive Web Reader response normalizer
  components/                     # WidgetCard, KPI, states, ticker pill
```
