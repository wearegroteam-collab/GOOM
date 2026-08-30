const DEFAULT_TIME_ZONE = "America/Toronto";

export function emailTimeZone() {
  return process.env.GOOM_TIME_ZONE || DEFAULT_TIME_ZONE;
}

export function formatEventDateTime(value: string | null, timeZone = emailTimeZone()) {
  if (!value) return { date: "Date to be announced", time: "Time to be announced" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "Date to be announced", time: "Time to be announced" };
  return {
    date: new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone }).format(parsed),
    time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).format(parsed),
  };
}

export function formatEmailMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(cents / 100);
}

export function humanizePaymentProvider(provider: string) {
  if (provider === "square") return "Square";
  if (provider === "mock") return "Test payment";
  return provider.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
