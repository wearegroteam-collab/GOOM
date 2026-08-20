import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EventForm } from "@/components/admin/EventForm";
export default function NewEventPage() { return <><AdminPageHeader eyebrow="Events" title="New event" description="Create a draft, publish it, or set it as the featured Home event." /><EventForm /></>; }
