const API_ORIGIN = "https://guis-arc-integrated-api-dev.gamzagui.workers.dev";
const STATIC_EXTENSION = /\.[a-z0-9]{1,12}$/i;

function isNavigationRequest(request) {
  const accept = request.headers.get("accept") || "";
  return request.method === "GET" && (
    request.mode === "navigate" || accept.includes("text/html")
  );
}

function isStaticAssetPath(pathname) {
  return STATIC_EXTENSION.test(pathname) || [
    "/assets/",
    "/packages/",
    "/modules/",
    "/routes/",
    "/shell/"
  ].some((prefix) => pathname.startsWith(prefix));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const target = new URL(url.pathname + url.search, API_ORIGIN);
      const headers = new Headers(request.headers);
      headers.delete("host");
      return fetch(new Request(target, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        redirect: "manual"
      }));
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) return assetResponse;

    // 정적 자산 요청에는 절대로 index.html을 반환하지 않는다.
    if (isStaticAssetPath(url.pathname)) {
      return new Response("정적 파일을 찾을 수 없습니다.", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    // 확장자 없는 브라우저 화면 경로만 SPA 진입점으로 폴백한다.
    if (isNavigationRequest(request)) {
      const indexUrl = new URL("/index.html", url.origin);
      return env.ASSETS.fetch(new Request(indexUrl, request));
    }

    return assetResponse;
  }
};
