/** Never serialize URL paths, query strings, bodies, headers or raw exceptions.
 * Paths themselves can contain student names, email addresses or tokens.
 */
export const requestLogSerializers = {
  req(req: { id?: unknown; method?: unknown }) {
    return { id: req.id, method: req.method };
  },
  res(res: { statusCode?: unknown }) { return { statusCode: res.statusCode }; },
  err() { return { category: 'request_failure' }; },
};

export function requestFailureMetadata(error: unknown) {
  // http-errors puts some status values on prototypes. Read data descriptors
  // without executing exception getters or copying arbitrary properties.
  function statusProperty(key: string): unknown {
    let value = error;
    for (let depth = 0; depth < 5 && value && typeof value === 'object'; depth++) {
      const property = Object.getOwnPropertyDescriptor(value, key);
      if (property) return property.value;
      value = Object.getPrototypeOf(value);
    }
    return undefined;
  }
  const statusValue = statusProperty('status') ?? statusProperty('statusCode');
  const status = typeof statusValue === 'number' && Number.isInteger(statusValue)
    && statusValue >= 400 && statusValue < 500 ? statusValue : 500;
  const category = status === 413 ? 'body_too_large' : status === 400 ? 'invalid_request'
    : status === 429 ? 'rate_limited' : status < 500 ? 'request_rejected' : 'request_failure';
  return { status, category };
}
