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

type SquareErrorDetail = {
  field?: unknown;
  message?: unknown;
  type?: unknown;
  errors?: unknown;
  errorList?: unknown;
};

function squareErrorDetails(value: unknown): SquareErrorDetail[] {
  if (Array.isArray(value)) return value.flatMap(squareErrorDetails);
  if (!value || typeof value !== "object") return [];
  const detail = value as SquareErrorDetail;
  return [detail, ...squareErrorDetails(detail.errors), ...squareErrorDetails(detail.errorList)];
}

export function isSquarePostalCodeError(value: unknown) {
  return squareErrorDetails(value).some((detail) => {
    const field = typeof detail.field === "string" ? detail.field.replace(/[\s_-]/g, "").toLowerCase() : "";
    if (["postalcode", "zipcode", "zip", "billingpostalcode", "billingzipcode"].includes(field)) return true;

    const message = [detail.type, detail.message]
      .filter((part): part is string => typeof part === "string")
      .join(" ");
    return /\bpostal(?:\s*code)?\b|\bzip(?:\s*code)?\b/i.test(message);
  });
}
