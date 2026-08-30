import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { createClient } from "@/lib/supabase/server";
import { fallbackSettings } from "@/lib/site-data";
import { formatServiceFeeInput, serviceFeeFromSettings } from "@/lib/ticketing/service-fee";
import { saveServiceFeeSettings, saveSettings } from "./actions";

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("site_settings").select("key,value") : { data: [] };
  const settings = { ...fallbackSettings, ...Object.fromEntries((data || []).map(item => [item.key, item.value || ""])) };
  const fee = serviceFeeFromSettings(settings);
  return <><AdminPageHeader eyebrow="Configuration" title="Site settings" description="Update public contact details, social destinations and ticket fees." />
    {query.fee_saved && <p className="admin-success">Ticket service fee settings saved.</p>}
    {query.fee_error && <p className="admin-form-error">The service fee could not be saved. Check the amount and try again.</p>}
    <form action={saveServiceFeeSettings} className="admin-editor admin-settings-form"><fieldset className="admin-event-section"><legend>Ticket Service Fee</legend><div className="admin-form-grid"><label className="admin-check full"><input name="service_fee_enabled" type="checkbox" defaultChecked={fee.enabled} />Enable service fee</label><label>Fee type<select name="service_fee_type" defaultValue={fee.type}><option value="fixed">Fixed amount</option><option value="percentage">Percentage</option></select></label><label>Fee amount<input name="service_fee_amount" inputMode="decimal" defaultValue={formatServiceFeeInput(fee)} required /><small>Fixed values are in CAD (for example 3.00). Percentage values can use up to two decimals (for example 7.5).</small></label></div></fieldset><div className="admin-form-actions"><button className="admin-primary-button" type="submit">Save ticket fee</button></div></form>
    <form action={saveSettings} className="admin-editor admin-settings-form"><div className="admin-form-grid"><label>Phone<input name="phone" defaultValue={settings.phone} /></label><label>WhatsApp<input name="whatsapp" defaultValue={settings.whatsapp} /></label><label className="full">Email<input name="email" type="email" defaultValue={settings.email} /></label><label>Instagram<input name="instagram" type="url" defaultValue={settings.instagram === "#" ? "" : settings.instagram} placeholder="https://…" /></label><label>Facebook<input name="facebook" type="url" defaultValue={settings.facebook === "#" ? "" : settings.facebook} placeholder="https://…" /></label><label>TikTok<input name="tiktok" type="url" defaultValue={settings.tiktok === "#" ? "" : settings.tiktok} placeholder="https://…" /></label><label>YouTube<input name="youtube" type="url" defaultValue={settings.youtube === "#" ? "" : settings.youtube} placeholder="https://…" /></label></div><div className="admin-form-actions"><button className="admin-primary-button" type="submit">Save settings</button></div></form></>;
}
