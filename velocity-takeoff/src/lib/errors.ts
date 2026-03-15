/**
 * Serialize an error for storage, including full message, cause chain, and stack.
 */
export function serializeError(err: unknown): string {
  const parts: string[] = [];

  function add(e: unknown, depth = 0): void {
    if (depth > 5) return; // Prevent infinite loops
    if (e instanceof Error) {
      parts.push(e.message);
      if (e.stack) parts.push(e.stack);
      if (e.cause && e.cause !== e) {
        parts.push('--- cause ---');
        add(e.cause, depth + 1);
      }
    } else {
      parts.push(String(e));
    }
  }

  add(err);
  return parts.join('\n');
}
