export type ShowpassWidgetConfig =
  | { kind: "iframe"; src: string }
  | { kind: "sdk"; slug: string; params: Record<string, string | boolean> };

function allowedShowpassUrl(value: string) {
  try {
    const url = new URL(value.replaceAll("&amp;", "&"));
    return url.protocol === "https:" && (url.hostname === "showpass.com" || url.hostname.endsWith(".showpass.com"))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function stringParameter(code: string, key: string) {
  const match = code.match(new RegExp(`["']${key}["']\\s*:\\s*["']([^"']+)["']`, "i"));
  return match?.[1]?.trim() || null;
}

function booleanParameter(code: string, key: string) {
  const match = code.match(new RegExp(`["']${key}["']\\s*:\\s*(true|false)`, "i"));
  return match ? match[1].toLowerCase() === "true" : null;
}

export function parseShowpassWidgetCode(code: string | null | undefined): ShowpassWidgetConfig | null {
  const value = code?.trim();
  if (!value || value.length > 20_000) return null;

  const iframeSource = value.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  if (iframeSource) {
    const src = allowedShowpassUrl(iframeSource);
    return src ? { kind: "iframe", src } : null;
  }

  if (/^https:\/\//i.test(value)) {
    const src = allowedShowpassUrl(value);
    return src ? { kind: "iframe", src } : null;
  }

  const widgetMatch = value.match(/(?:window\.)?showpass\.tickets\.eventPurchaseWidget\s*\(\s*["']([a-z0-9][a-z0-9_-]*)["']/i);
  if (!widgetMatch) return null;

  const params: Record<string, string | boolean> = {};
  for (const key of ["theme-primary", "show-specific-tickets", "tracking-id", "lang"] as const) {
    const parameter = stringParameter(value, key);
    if (parameter) params[key] = parameter;
  }
  for (const key of ["keep-shopping", "show-description"] as const) {
    const parameter = booleanParameter(value, key);
    if (parameter !== null) params[key] = parameter;
  }

  return { kind: "sdk", slug: widgetMatch[1], params };
}
