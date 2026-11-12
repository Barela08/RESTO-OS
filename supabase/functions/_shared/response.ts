import { corsHeaders } from './cors.ts';

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400, errorCode?: string, details?: unknown) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      errorCode:
        errorCode ||
        (status === 401
          ? 'UNAUTHORIZED'
          : status === 403
          ? 'FORBIDDEN'
          : status === 404
          ? 'NOT_FOUND'
          : status === 429
          ? 'RATE_LIMITED'
          : 'BAD_REQUEST'),
      details,
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
