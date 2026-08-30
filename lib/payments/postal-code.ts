export function normalizePostalCode(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
  const compact = normalized.replace(/\s/g, "");
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)) return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  return normalized;
}

export function isFriendlyPostalCode(value: string) {
  const normalized = normalizePostalCode(value);
  return normalized.length >= 3
    && normalized.length <= 16
    && /^[A-Z0-9][A-Z0-9 -]*[A-Z0-9]$/.test(normalized);
}
