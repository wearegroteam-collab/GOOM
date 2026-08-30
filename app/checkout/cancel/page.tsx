import Link from "next/link";
export default function CheckoutCancel() { return <main className="checkout-status-page"><div className="checkout-result"><span>Checkout cancelled</span><h1>Your payment was not completed.</h1><p>No tickets were generated and no successful payment was recorded.</p><Link href="/events" className="button">Return to event</Link></div></main>; }
