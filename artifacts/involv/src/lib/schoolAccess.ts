export const SCHOOL_DOMAIN = 'iszl.ch';
export const SCHOOL_ACCESS_MESSAGE = 'Involv is only available to verified @iszl.ch accounts. Please sign in with your ISZL Google account.';

/** This is a UI check only. The database and Auth Hook enforce access. */
export function isSchoolEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && /^[^@\s]+@iszl\.ch$/i.test(email);
}

export function hasSchoolAccess(user: {
  email?: string;
  email_confirmed_at?: string;
}): boolean {
  return isSchoolEmail(user.email) && Boolean(user.email_confirmed_at);
}
