import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { createClient } from "@/lib/supabase/server";
import { fallbackSettings } from "@/lib/site-data";
import { saveSettings } from "./actions";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("site_settings").select("key,value") : { data: [] };
  const settings = { ...fallbackSettings, ...Object.fromEntries((data || []).map(item => [item.key, item.value || ""])) };
  return <><AdminPageHeader eyebrow="Configuration" title="Site settings" description="Update public contact details and social destinations." /><form action={saveSettings} className="admin-editor admin-settings-form"><div className="admin-form-grid"><label>Phone<input name="phone" defaultValue={settings.phone} /></label><label>WhatsApp<input name="whatsapp" defaultValue={settings.whatsapp} /></label><label className="full">Email<input name="email" type="email" defaultValue={settings.email} /></label><label>Instagram<input name="instagram" type="url" defaultValue={settings.instagram === "#" ? "" : settings.instagram} placeholder="https://…" /></label><label>Facebook<input name="facebook" type="url" defaultValue={settings.facebook === "#" ? "" : settings.facebook} placeholder="https://…" /></label><label>TikTok<input name="tiktok" type="url" defaultValue={settings.tiktok === "#" ? "" : settings.tiktok} placeholder="https://…" /></label><label>YouTube<input name="youtube" type="url" defaultValue={settings.youtube === "#" ? "" : settings.youtube} placeholder="https://…" /></label></div><div className="admin-form-actions"><button className="admin-primary-button" type="submit">Save settings</button></div></form></>;
}
