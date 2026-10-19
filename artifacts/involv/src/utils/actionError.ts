type Action = 'signin' | 'account' | 'apply' | 'save' | 'load' | 'review' | 'withdraw' | 'listing';
/** Provider messages, SQL details, URL descriptions and stacks are untrusted text. */
export function actionError(error: unknown, action: Action): string {
  const value = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown } : {};
  const code = typeof value.code === 'string' ? value.code : '';
  if (code === '42703' || code === 'PGRST204') {
    return 'The opportunity database needs the latest Involv setup before this can work. Apply the opportunity programme filters migration in Supabase, then refresh.';
  }
  if (code === 'IV001') return 'This activity is no longer accepting applications. Your answers are kept here.';
  if (code === 'IV002') return 'The application deadline has passed (school time). Your answers are kept here.';
  if (code === 'IV003') return 'All places have been filled. Your answers are kept here; check the listing again later.';
  if (code === 'IV004') return 'No places remain. This acceptance was not saved. Refresh the applications before making another decision.';
  if (code === 'IV005') return 'Total places must be at least one and cannot be fewer than the number of accepted students.';
  if (code === 'IV006') return 'Use at least 30 characters for motivation and provide availability. Keep motivation and experience under 10,000 characters, availability under 2,000, and grade under 100.';
  if (code === '23505' && action === 'apply') return 'You have already applied. Check My Applications before trying again.';
  if (code === '23503' && (action === 'apply' || action === 'save')) return 'This opportunity is no longer available. Refresh the listings.';
  if (code === '42501' || code === 'access_denied') return action === 'signin' || action === 'account'
    ? 'Access was not approved. Use your verified @iszl.ch account; if Google says administrator review is required, contact school IT.'
    : 'This action is not allowed with your current access. Refresh, then contact the supervising staff member if it persists.';
  if (value.status === 429 || code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') return 'Too many attempts. Wait a minute before trying again.';
  if (code === 'PGRST301' || code === 'session_expired' || value.status === 401) return 'Your session has expired. Sign in again, then retry.';
  if (code === 'user_cancelled' || code === 'access_denied_by_user') return 'Sign-in was cancelled. You can try again when ready.';
  if (action === 'signin') return 'Sign-in could not be completed. Check your connection and try again. If no sign-in tab opens, allow pop-ups or open Involv in its own browser tab. If Google blocks the app, ask school IT to review it.';
  if (action === 'account') return 'Your school account could not be set up. Retry, or contact the supervising staff member. Do not create another account.';
  if (action === 'apply') return 'We could not confirm your application. Your answers are kept here. Check My Applications before retrying to avoid a duplicate.';
  if (action === 'save') return 'Your saved-list change could not be confirmed. It has been reversed on this screen; refresh to check the stored result, then retry.';
  if (action === 'review') return 'The status change was not confirmed. Refresh to check the current decision before retrying.';
  if (action === 'withdraw') return 'Withdrawal was not confirmed. Refresh My Applications before retrying.';
  if (action === 'listing') return 'Your listing change could not be confirmed. Your edits are kept here; refresh the listing in another tab before retrying.';
  return 'Data could not be refreshed. Check your connection and retry. Previously loaded information may be out of date.';
}
