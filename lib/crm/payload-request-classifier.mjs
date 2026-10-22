const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function headerValue(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key]) : "";
}

function safeRoute(pathname) {
  if (/^\/api\/central-leads\/[^/]+\/?$/.test(pathname)) return "/api/central-leads/:id";
  const route = pathname.replace(/\/$/, "") || "/";
  if (["/api/users", "/api/users/login", "/api/users/me", "/api/crm-offices", "/api/crm-teams"].includes(route)) return route;
  return route.startsWith("/api/") ? "/api/other" : "/";
}

/** Classify Payload REST traffic without retaining query values or request bodies. */
export function classifyPayloadRequest(url, method, headers = {}) {
  const parsed = new URL(url, "http://127.0.0.1");
  const route = safeRoute(parsed.pathname);
  const actualMethod = String(method || "GET").toUpperCase();
  const override = headerValue(headers, "X-Payload-HTTP-Method-Override").toUpperCase();
  const relationshipRead = ["/api/users", "/api/crm-offices", "/api/crm-teams"].includes(route);
  const effectiveMethod = actualMethod === "POST" && override === "GET" && relationshipRead ? "GET" : actualMethod;
  return {
    route,
    method: actualMethod,
    effectiveMethod,
    mutation: !READ_METHODS.has(effectiveMethod),
  };
}

export function isPayloadRelationshipRead(request) {
  return request?.method === "POST" && request?.effectiveMethod === "GET" &&
    ["/api/users", "/api/crm-offices", "/api/crm-teams"].includes(request.route);
}

/** A denied cross-origin read stays blocked without aborting the QA run. */
export function browserGuardDisposition(url, request, baseURL) {
  if (new URL(url).origin === new URL(baseURL).origin) return "local";
  return request?.mutation ? "block-mutation" : "block-read";
}

/** Next.js devtools POST reads source maps for an error overlay; it is not a CRM write. */
export function isNextDevtoolsStackLookup(url, request, baseURL) {
  const parsed = new URL(url);
  return parsed.origin === new URL(baseURL).origin &&
    parsed.pathname === "/__nextjs_original-stack-frames" &&
    request?.method === "POST" && request?.effectiveMethod === "POST";
}

/** Fail closed: permit one exact-lead update only when its new follow-up forces server validation to reject it. */
export function isApprovedInvalidFollowUpUpdate(request, url, body, expectedLeadId, originalValue, now = new Date()) {
  if (request?.route !== "/api/central-leads/:id" || request.method !== "PATCH" ||
      request.effectiveMethod !== "PATCH" || typeof body !== "string") return false;
  const pathname = new URL(url, "http://127.0.0.1").pathname;
  if (pathname !== `/api/central-leads/${expectedLeadId}`) return false;
  const match = body.match(/(?:^|\r?\n)Content-Disposition: form-data; name="_payload"\r?\n\r?\n([^\r\n]+)/);
  if (!match) return false;
  try {
    const data = JSON.parse(match[1]);
    if (!data || typeof data !== "object" || Array.isArray(data)) return false;
    const value = data.nextFollowUpAt;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return Number.isFinite(Date.parse(value)) &&
      new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value.slice(0, 10) &&
      Date.parse(value) < now.getTime() && value !== originalValue;
  } catch { return false; }
}
