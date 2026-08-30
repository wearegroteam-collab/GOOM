export type ServiceFeeType = "fixed" | "percentage";

export type ServiceFeeConfig = {
  enabled: boolean;
  type: ServiceFeeType;
  /** Fixed fees use cents; percentage fees use basis points (7.5% = 750). */
  value: number;
};

export const DEFAULT_SERVICE_FEE: ServiceFeeConfig = { enabled: false, type: "fixed", value: 0 };
export const MAX_FIXED_SERVICE_FEE_CENTS = 10_000_000;

export function calculateServiceFeeCents(subtotalCents: number, config: ServiceFeeConfig) {
  if (!config.enabled || subtotalCents <= 0 || !Number.isInteger(config.value) || config.value < 0) return 0;
  if (config.type === "fixed") return config.value;

  // Percentage values are basis points. Adding half the denominator applies
  // round-half-up to the nearest cent without floating-point money arithmetic.
  return Number((BigInt(subtotalCents) * BigInt(config.value) + BigInt(5_000)) / BigInt(10_000));
}

function decimalParts(input: string, maximumDecimals: number) {
  const match = input.trim().match(new RegExp(`^(\\d+)(?:\\.(\\d{1,${maximumDecimals}}))?$`));
  if (!match) return null;
  return { whole: match[1], fraction: (match[2] || "").padEnd(maximumDecimals, "0") };
}

export function parseFixedFeeInput(input: string) {
  const parts = decimalParts(input, 2);
  if (!parts) return null;
  const value = Number(BigInt(parts.whole) * BigInt(100) + BigInt(parts.fraction));
  return Number.isSafeInteger(value) && value <= MAX_FIXED_SERVICE_FEE_CENTS ? value : null;
}

export function parsePercentageFeeInput(input: string) {
  const parts = decimalParts(input, 2);
  if (!parts) return null;
  const value = Number(BigInt(parts.whole) * BigInt(100) + BigInt(parts.fraction));
  return Number.isSafeInteger(value) && value <= 10_000 ? value : null;
}

export function parseServiceFeeValue(type: ServiceFeeType, input: string) {
  return type === "fixed" ? parseFixedFeeInput(input) : parsePercentageFeeInput(input);
}

export function formatServiceFeeInput(config: Pick<ServiceFeeConfig, "type" | "value">) {
  const whole = Math.floor(config.value / 100);
  const fraction = String(config.value % 100).padStart(2, "0");
  return config.type === "fixed" ? `${whole}.${fraction}` : `${whole}.${fraction}`.replace(/\.?0+$/, "");
}

export function serviceFeeFromSettings(settings: Record<string, string | null | undefined>): ServiceFeeConfig {
  const type: ServiceFeeType = settings.service_fee_type === "percentage" ? "percentage" : "fixed";
  const value = Number(settings.service_fee_value || 0);
  return {
    enabled: settings.service_fee_enabled === "true",
    type,
    value: Number.isSafeInteger(value) && value >= 0 && (type === "percentage" ? value <= 10_000 : value <= MAX_FIXED_SERVICE_FEE_CENTS) ? value : 0,
  };
}

export function effectiveServiceFee(
  event: { use_global_service_fee?: boolean; service_fee_enabled?: boolean; service_fee_type?: ServiceFeeType; service_fee_value?: number },
  globalFee: ServiceFeeConfig,
): ServiceFeeConfig {
  if (event.use_global_service_fee !== false) return globalFee;
  return {
    enabled: event.service_fee_enabled === true,
    type: event.service_fee_type === "percentage" ? "percentage" : "fixed",
    value: Number.isSafeInteger(event.service_fee_value) && (event.service_fee_value || 0) >= 0 && (event.service_fee_type === "percentage" ? (event.service_fee_value || 0) <= 10_000 : (event.service_fee_value || 0) <= MAX_FIXED_SERVICE_FEE_CENTS) ? event.service_fee_value || 0 : 0,
  };
}
