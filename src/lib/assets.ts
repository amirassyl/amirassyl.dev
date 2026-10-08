import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * A short hash of a file's contents, for putting in its URL as `?v=…`.
 * The URL then changes whenever the file does, so browsers never use a stale copy.
 */
export function fileVersion(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 8);
}
