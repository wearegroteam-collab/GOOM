import { OrderStatus } from "@/components/ticketing/OrderStatus";
export default async function CheckoutSuccess({ searchParams }: { searchParams: Promise<{ order?: string }> }) { const { order } = await searchParams; return <main className="checkout-status-page">{order ? <OrderStatus token={order} /> : <div className="checkout-result"><h1>Order not found.</h1></div>}</main>; }
