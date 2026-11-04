/** Bounded public access explicitly requested for testing.
 * This fixed deadline must be enforced on every page and API request.
 * ESCALA_REQUIRE_LOGIN=true closes access earlier; false cannot extend it.
 */
export const OPEN_ACCESS_UNTIL = '2026-11-06T18:02:47.000Z';
export function loginRequired(now = Date.now()) {
  if (now >= Date.parse(OPEN_ACCESS_UNTIL)) return true;
  const setting = process.env.ESCALA_REQUIRE_LOGIN;
  return setting === undefined ? false : setting.trim().toLowerCase() !== 'false';
}
