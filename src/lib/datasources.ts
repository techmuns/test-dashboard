/**
 * Registered datasource definitions from datasource-registry.md.
 *
 * Only datasources documented in the registry may be used. Full URLs are built
 * from base_urls[service] + endpoint path. All calls use the host-provided JWT
 * as a bearer token; no API keys or secrets live in the dashboard.
 */

export const DASHBOARD_BASE_URLS = {
  fastapi: "https://fastapi.muns.io",
  nestjs: "https://devde.muns.io",
} as const;

type Service = keyof typeof DASHBOARD_BASE_URLS;

interface Datasource {
  id: string;
  service: Service;
  path: string;
  rateLimitPerMinute: number;
  cacheTtlSeconds: number;
}

export const DASHBOARD_DATASOURCES = {
  // Read and extract content from one or more URLs.
  web_reader: {
    id: "web_reader",
    service: "fastapi",
    path: "/tools/web-reader",
    rateLimitPerMinute: 60,
    cacheTtlSeconds: 300,
  },
  // Stream an AI answer grounded in the dashboard context.
  muns_chat: {
    id: "muns_chat",
    service: "nestjs",
    path: "/chat/chat-muns",
    rateLimitPerMinute: 30,
    cacheTtlSeconds: 0,
  },
} satisfies Record<string, Datasource>;

export function datasourceUrl(ds: Datasource): string {
  return DASHBOARD_BASE_URLS[ds.service] + ds.path;
}

export const DASHBOARD_REQUEST_TIMEOUT_MS = 30_000;
