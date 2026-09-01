"use client";
import { useEffect, useRef, useState } from "react";
import { CreditCard, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { isFriendlyPostalCode, isSquarePostalCodeError, normalizePostalCode } from "@/lib/payments/postal-code";

type SquareBillingContact = {
  postalCode?: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  phone?: string;
};

type SquareVerificationDetails = {
  amount: string;
  currencyCode: string;
  intent: "CHARGE";
  customerInitiated: true;
  sellerKeyedIn: false;
  billingContact?: SquareBillingContact;
};

type SquareTokenResult = {
  status: string;
  token?: string;
  errors?: Array<{ field?: string; message?: string; type?: string }>;
};

type SquareCard = {
  attach: (selector: string) => Promise<void>;
  configure: (options: { postalCode?: string }) => Promise<void>;
  tokenize: (details?: SquareVerificationDetails) => Promise<SquareTokenResult>;
  destroy: () => Promise<void>;
};

declare global { interface Window { Square?: { payments: (applicationId: string, locationId: string) => Promise<{ setLocale: (locale: string) => Promise<unknown>; card: () => Promise<SquareCard> }> } } }

export function CheckoutPayment({ orderToken, amountCents, currency, customerName, customerEmail, customerPhone }: { orderToken: string; amountCents: number; currency: string; customerName: string; customerEmail: string; customerPhone?: string | null }) {
  const router = useRouter();
  const [provider, setProvider] = useState<"loading" | "mock" | "square" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [postalRequired, setPostalRequired] = useState(false);
  const [postalError, setPostalError] = useState(false);
  const cardRef = useRef<SquareCard | null>(null);
  const postalInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { let cancelled = false; let script: HTMLScriptElement | null = null; (async () => { const configResponse = await fetch("/api/payments/square/config"); const config = await configResponse.json(); if (!configResponse.ok) { setProvider("error"); return; } if (config.provider === "mock") { setProvider("mock"); return; }
    script = document.createElement("script"); script.src = config.environment === "production" ? "https://web.squarecdn.com/v1/square.js" : "https://sandbox.web.squarecdn.com/v1/square.js"; script.async = true; script.onload = async () => { if (cancelled || !window.Square) return; try { const payments = await window.Square.payments(config.applicationId, config.locationId); await payments.setLocale("en-CA"); const card = await payments.card(); await card.attach("#square-card-container"); cardRef.current = card; setProvider("square"); } catch { setProvider("error"); } }; document.head.appendChild(script);
    })(); return () => { cancelled = true; void cardRef.current?.destroy(); script?.remove(); }; }, []);

  async function pay(sourceId: string, tokenizationStatus?: string) { setBusy(true); setError(""); const response = await fetch("/api/payments/charge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderToken, sourceId, tokenizationStatus }) }); const data = await response.json(); if (!response.ok || data.status === "failed") { setError(data.error || "Payment could not be completed. Try again."); setBusy(false); return; } router.push(`/checkout/success?order=${encodeURIComponent(orderToken)}`); }

  function requestPostalCode() {
    setPostalRequired(true);
    setPostalError(true);
    setError("");
    window.requestAnimationFrame(() => postalInputRef.current?.focus());
  }

  async function submitSquare() {
    if (busy) return;
    const card = cardRef.current;
    if (!card) { setError("Secure card entry is not ready yet. Please try again."); return; }

    setBusy(true);
    setError("");
    setPostalError(false);

    const normalizedPostalCode = normalizePostalCode(postalCode);
    if (postalRequired && !isFriendlyPostalCode(normalizedPostalCode)) {
      setPostalError(true);
      setBusy(false);
      return;
    }

    const [givenName, ...familyParts] = customerName.trim().split(/\s+/);
    const billingContact: SquareBillingContact = {
      givenName,
      familyName: familyParts.join(" ") || undefined,
      email: customerEmail,
      phone: customerPhone || undefined,
      ...(postalRequired ? { postalCode: normalizedPostalCode } : {}),
    };

    try {
      if (postalRequired) await card.configure({ postalCode: normalizedPostalCode });
      const result = await card.tokenize({
        amount: (amountCents / 100).toFixed(2),
        currencyCode: currency,
        intent: "CHARGE",
        customerInitiated: true,
        sellerKeyedIn: false,
        billingContact,
      });

      if (result.status === "OK" && result.token) {
        await pay(result.token, result.status);
        return;
      }

      if (isSquarePostalCodeError(result.errors)) requestPostalCode();
      else setError("Please review your card details and try again.");
    } catch (squareError) {
      if (isSquarePostalCodeError(squareError)) requestPostalCode();
      else setError("Square could not validate the card. Please try again.");
    }
    setBusy(false);
  }

  return <div className="payment-box"><div className="payment-title"><CreditCard /><div><h2>Secure payment</h2><p>Card details are tokenized by Square and never stored by GOOM.</p></div></div>{provider === "loading" && <p>Loading secure payment…</p>}{provider === "error" && <p className="checkout-error">Online payment is temporarily unavailable.</p>}<div id="square-card-container" className={provider === "square" ? "" : "is-hidden"} />{provider === "square" && postalRequired && <label className="checkout-postal-code">Postal code / ZIP<input ref={postalInputRef} type="text" inputMode="text" autoCapitalize="characters" autoComplete="postal-code" maxLength={16} value={postalCode} aria-invalid={postalError} aria-describedby={postalError ? "checkout-postal-error" : undefined} onChange={(input) => { setPostalCode(input.target.value.toUpperCase()); setPostalError(false); }} onBlur={() => setPostalCode((value) => normalizePostalCode(value))} placeholder="L2R 3A6 or 90210" />{postalError && <span id="checkout-postal-error" className="checkout-postal-error">Please enter a valid postal code or ZIP.</span>}</label>}{provider === "square" && <button className="button" disabled={busy} onClick={submitSquare}>{busy ? "Processing…" : "Pay securely"}</button>}{provider === "mock" && <div className="mock-payments"><p>Development payment simulator</p><button className="button" disabled={busy} onClick={() => pay("mock-success")}>Simulate successful payment</button><button className="outline-link" disabled={busy} onClick={() => pay("mock-failure")}>Simulate failed payment</button></div>}{error && <p className="checkout-error">{error}</p>}<p className="secure-note"><LockKeyhole />Encrypted and securely processed.</p></div>;
}
