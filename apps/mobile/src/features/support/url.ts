// Where the app opens the support stream (pure, tested in scripts/ai-lib.test.mts).
// The BFF hands out the service's configured stream URL (SUPPORT_STREAM_URL; in development the service itself on
// loopback) or none (production: the browser uses wss://<Client Area host>/support/stream, mapped by Caddy).
// A phone can't reach a loopback URL, so then the app goes through the host it already talks to: the production
// edge, or the mobile dev relay on the LAN, which both map /support/stream to the service.

const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|::1|.*\.localhost)$/i;
const hostOf = (url: string) => /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?(\[[^\]]+\]|[^:/?#]+)/i.exec(url)?.[1] ?? "";

export function streamBase(ticketUrl: string | null | undefined, apiBase: string): string {
  const edge = `${apiBase.replace(/\/+$/, "").replace(/^http/, "ws")}/support/stream`;
  if (!ticketUrl) return edge;
  return LOOPBACK.test(hostOf(ticketUrl)) && !LOOPBACK.test(hostOf(apiBase)) ? edge : ticketUrl;
}
