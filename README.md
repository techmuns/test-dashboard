# Ask the Web — Munshot Embedded Dashboard

A Munshot embedded dashboard that reads a URL and answers a question grounded in
that page's content. Built with the **dashboard-skill** standards (3-zone iframe
shell, `WidgetCard`, host-context auth, registered datasources, full state
handling, and visual export).

## What it does

Two inputs drive the dashboard:

| Input         | Datasource                       | Purpose                                  |
| ------------- | -------------------------------- | ---------------------------------------- |
| **Source URL** | `web_reader` (fastapi)           | Reads & extracts the page content        |
| **Question**   | `muns_chat` (nestjs, streaming)  | Streams an AI answer grounded in the page |

Flow: the URL is read with **Web Reader**, then the extracted content is
forwarded into **Muns Chat** via `DASHBOARD_INPUTS`, and the answer streams in
progressively. If the question is left blank, the page is summarized.

## Layout (Zone 2 order)

1. **Context/filters** — URL + question inputs and the Read & Ask action
2. **KPIs** — source read status, words extracted, answer status, generated time
3. **Primary analysis** — streaming AI answer
4. **Insights** — grounding/source note and extraction-quality note
5. **Detail** — request-context table + extracted-content preview
6. **Source/provenance** — source trail with URL, timestamps, chat/message IDs

## Standards applied

- 3-zone shell, 48px sticky header, single scrolling Zone 2
  (`#dashboard-main`, `data-dashboard-capture-root`)
- Every data widget uses `WidgetCard`; indigo + grayscale design tokens
- Auth via the Munshot Dashboard SDK (`useHostContext`); bearer token from
  `context.session.token`, ticker from `context.market.selectedTicker`
- Only registered datasources (`web_reader`, `muns_chat`), URLs built from
  `base_urls[service] + endpoint`
- States: shimmer loading, waiting-for-session, empty, partial, friendly error
- `dashboard.capture.visual` handler via `html-to-image` (returns a `Blob`)

## Develop

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build
npm run typecheck  # types only
```

The dashboard is designed to run inside a Munshot iframe at `width: 100%` /
`height: 100vh`. Opened standalone (no SDK host), it renders in a degraded
"Waiting for session..." state since no JWT is provided.

## Structure

```
src/
  main.tsx                       # SDK lifecycle start + mount
  dashboard_ask_web.tsx          # the dashboard (Zone 2 layout + widgets)
  hooks/
    useHostContext.ts            # session token + market selection
    useVisualCapture.ts          # dashboard.capture.visual handler
  lib/
    sdk.ts                       # Munshot Dashboard SDK wrapper
    datasources.ts               # registered datasource definitions
    api.ts                       # web_reader + muns_chat (streaming) clients
    extract.ts                   # web_reader result coercion helpers
  components/
    component_WidgetCard.tsx
    component_QueryControls.tsx
    component_KpiTile.tsx
    component_TickerPill.tsx
    component_states.tsx
```
