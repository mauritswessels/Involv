type SafeErrorContext = {
  componentStack?: string | null;
};

type SafeErrorDetails = {
  errorType: string;
  code?: string;
  status?: number;
  componentStack?: string;
};

const knownErrorTypes = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
  'AbortError',
  'AuthError',
  'AuthApiError',
  'AuthRetryableFetchError',
  'AuthSessionMissingError',
  'AuthPKCECodeVerifierMissingError',
  'PostgrestError',
  'FunctionsFetchError',
  'FunctionsHttpError',
  'FunctionsRelayError',
  'StorageApiError',
  'StorageUnknownError',
  'RealtimeError',
]);

const knownProviderCodes = new Set([
  'email_exists',
  'phone_exists',
  'user_already_exists',
  'invalid_credentials',
  'email_not_confirmed',
  'phone_not_confirmed',
  'weak_password',
  'validation_failed',
  'over_email_send_rate_limit',
  'over_sms_send_rate_limit',
  'otp_expired',
  'otp_disabled',
  'flow_state_expired',
  'bad_oauth_state',
  'provider_disabled',
  'user_banned',
  'invite_not_found',
  'invalid_token',
  'bad_jwt',
  'request_timeout',
]);

function readProperty(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  return (value as Record<string, unknown>)[key];
}

function safeErrorType(value: unknown, isError: boolean): string {
  return typeof value === 'string' && knownErrorTypes.has(value)
    ? value
    : isError
      ? 'Error'
      : 'UnknownError';
}

function safeErrorCode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (/^\d{5}$/.test(value) || /^PGRST\d{3}$/.test(value)) return value;
  return knownProviderCodes.has(value) ? value : undefined;
}

function safeStatus(value: unknown): number | undefined {
  const status =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d{3}$/.test(value)
        ? Number(value)
        : undefined;

  return Number.isInteger(status) && status! >= 100 && status! <= 599
    ? status
    : undefined;
}

function safeComponentStack(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const sanitized = value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
    .slice(0, 2000);
  return sanitized || undefined;
}

/**
 * Log only operational error metadata. Error messages, details, and stacks can
 * contain profile fields, email addresses, or submitted application content.
 */
export function logSafeError(
  operation: string,
  error: unknown,
  context?: SafeErrorContext,
): void {
  const errorType = safeErrorType(
    readProperty(error, 'name'),
    error instanceof Error,
  );
  const code = safeErrorCode(readProperty(error, 'code'));
  const status =
    safeStatus(readProperty(error, 'status')) ??
    safeStatus(readProperty(error, 'statusCode'));
  const componentStack = safeComponentStack(context?.componentStack);

  const details: SafeErrorDetails = {
    errorType,
    ...(code ? { code } : {}),
    ...(status ? { status } : {}),
    ...(componentStack ? { componentStack } : {}),
  };

  console.error(operation, details);
}

/** Log a fixed informational event with a numeric count and no record contents. */
export function logSafeInfo(event: string, count?: number): void {
  if (Number.isSafeInteger(count) && count! >= 0) {
    console.info(event, { count });
  } else {
    console.info(event);
  }
}
