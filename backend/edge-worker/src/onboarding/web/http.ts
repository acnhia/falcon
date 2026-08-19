/** Transport helper. Confined to web/ so no service or domain module builds HTTP responses. */
export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}
