import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminActionForm, AdminSubmitButton } from "@/components/admin/AdminActionForm";
import { AdminImageInput } from "@/components/admin/AdminImageInput";
import { createClient } from "@/lib/supabase/server";
import type { ServiceRecord } from "@/lib/supabase/types";
import { deleteService, saveService } from "./actions";

const icons = ["music", "disc", "heart", "utensils", "sparkles"];

function ServiceFields({ service }: { service?: ServiceRecord }) {
  const imageId = `service-image-${service?.id || "new"}`;
  return <>
    <input type="hidden" name="current_image_url" value={service?.image_url || ""} />
    <label>Title<input name="title" defaultValue={service?.title} required /></label>
    <label>Description<textarea name="description" rows={3} defaultValue={service?.description || ""} /></label>
    <label htmlFor={imageId}>Image<AdminImageInput id={imageId} name="uploaded_image_url" bucket="services" /></label>
    <div className="admin-inline-fields">
      <label>Icon<select name="icon" defaultValue={service?.icon || "sparkles"}>{icons.map(icon => <option key={icon}>{icon}</option>)}</select></label>
      <label>Order<input name="sort_order" type="number" min="0" defaultValue={service?.sort_order || 0} /></label>
      <label className="admin-check"><input name="active" type="checkbox" defaultChecked={service?.active ?? true} />Active</label>
    </div>
  </>;
}

export default async function AdminServicesPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("services").select("*").order("sort_order") : { data: [] };
  const services = (data || []) as ServiceRecord[];
  return <>
    <AdminPageHeader eyebrow="Content" title="Services" description="Create, order and control the services shown on the public site." />
    <section className="admin-content-stack">
      <AdminActionForm action={saveService.bind(null, null)} className="admin-record-card">
        <div className="admin-record-heading"><div><span>New service</span><h2>Add a service</h2></div><AdminSubmitButton pendingLabel="Uploading…">Create</AdminSubmitButton></div>
        <ServiceFields />
      </AdminActionForm>
      {services.map(service => <AdminActionForm action={saveService.bind(null, service.id)} className="admin-record-card" key={service.id}>
        <div className="admin-record-heading"><div><span>Service #{service.sort_order}</span><h2>{service.title}</h2></div><div><AdminSubmitButton className="admin-secondary-button" pendingLabel="Uploading…">Save</AdminSubmitButton><button className="admin-danger-button" formAction={deleteService.bind(null, service.id, service.image_url)} type="submit">Delete</button></div></div>
        <ServiceFields service={service} />
      </AdminActionForm>)}
    </section>
  </>;
}
