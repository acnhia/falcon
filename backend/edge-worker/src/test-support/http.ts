/**
 * Reads a JSON response body for assertions.
 *
 * `Response.json()` is typed `unknown` under strict mode, which is correct for production code but
 * unhelpful in tests that assert against API shapes they already know. Callers may pass a shape
 * explicitly - `readJson<{ error: string }>(res)` - and the permissive default keeps assertions on
 * ad-hoc response shapes readable. This affordance is deliberately confined to test support so it
 * cannot leak into runtime code.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJson<T = any>(response: Response): Promise<T> {
  return (await response.json()) as T
}
