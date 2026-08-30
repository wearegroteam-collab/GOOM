import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TicketScanner } from "@/components/admin/TicketScanner";
export default function ScannerPage() { return <><AdminPageHeader eyebrow="Door operations" title="Ticket scanner" description="Scan an individual QR, verify its status, then check the guest in. The update is atomic across all devices." /><TicketScanner /></>; }
