import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEFAULT_PUBLIC_ORIGIN = "https://cafeflow.alpana1project.workers.dev";

class PublicApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers({
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  const configuredOrigin = process.env["WEBSITE_PUBLIC_ORIGIN"]?.trim();
  const allowedOrigin = configuredOrigin || DEFAULT_PUBLIC_ORIGIN;
  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin === allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
  return headers;
}

function jsonResponse(request: Request, body: unknown, status = 200): Response {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

export function publicOptions(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function publicGet<T>(
  request: Request,
  loader: () => Promise<T>,
): Promise<Response> {
  try {
    return jsonResponse(request, { data: await loader() });
  } catch (error) {
    if (error instanceof PublicApiError) {
      return jsonResponse(request, {
        error: { code: error.code, message: error.message },
      }, error.status);
    }
    console.error("[Website Public API] Request failed");
    return jsonResponse(request, {
      error: { code: "INTERNAL_SERVER_ERROR", message: "Unable to retrieve website content." },
    }, 500);
  }
}

export function resourceNotFound(resource: string): never {
  throw new PublicApiError(404, "NOT_FOUND", `${resource} not found.`);
}

export { supabaseAdmin };
