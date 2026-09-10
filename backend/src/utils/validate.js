// Lightweight, dependency-free input validators used across routes.

export function isEmail(value) {
  return (
    typeof value === 'string' &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  )
}

export function isNonEmptyString(value, maxLen = 100000) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLen
}

export function isOptionalString(value, maxLen = 100000) {
  return value === undefined || value === null || (typeof value === 'string' && value.length <= maxLen)
}

export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isBoolean(value) {
  return typeof value === 'boolean'
}

export function isPositiveNumber(value, max = Number.MAX_SAFE_INTEGER) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= max
}

export function isArrayOrEmpty(value, maxItems = 1000) {
  return Array.isArray(value) && value.length <= maxItems
}

export function fail(res, message, status = 400) {
  return res.status(status).json({ error: message })
}