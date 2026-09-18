/**
 * User display helpers.
 *
 * The backend `auth.me` returns only `userId`, `staffId`, `email` and `role`.
 * The Users sheet has no display-name column in the confirmed contract, so
 * nothing here invents one — these helpers derive presentation values from the
 * real email only.
 */

/**
 * @param email The authenticated email address.
 * @return Up to two initials from the local part (e.g. 'paul.mensah' -> 'PM').
 */
export function getUserInitials(email?: string | null): string {
  const local = (email ?? '').split('@')[0] ?? '';
  const parts = local.split(/[._\-+]+/).filter((part) => part !== '');

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

/**
 * @param email The authenticated email address.
 * @return A short label for the current user; the email itself is authoritative.
 */
export function getUserLabel(email?: string | null): string {
  const trimmed = (email ?? '').trim();
  return trimmed === '' ? 'Signed-in user' : trimmed;
}
