/**
 * Discriminated union for Server Action return values.
 * Per CodeStandards.md: Server Actions never throw for expected failures.
 * They return this union so the client can handle errors without try/catch.
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
