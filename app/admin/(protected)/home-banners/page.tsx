import Image from "next/image";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminActionForm, AdminSubmitButton } from "@/components/admin/AdminActionForm";
import { AdminImageInput } from "@/components/admin/AdminImageInput";
import { createClient } from "@/lib/supabase/server";
import type { HomeBannerRecord } from "@/lib/supabase/types";
import { addHomeBanner, deleteHomeBanner, updateHomeBanner } from "./actions";

const sizes = [
  ["Desktop", "1920 × 700 px", "Wide 2.74:1 composition"],
  ["Tablet", "1200 × 900 px", "Landscape 4:3 composition"],
  ["Mobile", "1080 × 1350 px", "Portrait 4:5 composition"],
] as const;

export default async function AdminHomeBannersPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("home_banners").select("*").order("sort_order") : { data: [] };
  const banners = (data || []) as HomeBannerRecord[];
  return <>
    <AdminPageHeader eyebrow="Home page" title="Home banners" description="Create and order the promotional banners shown in the home carousel." />
    <section className="admin-banner-guide" aria-label="Recommended banner dimensions">
      {sizes.map(([device, dimensions, note]) => <div key={device}><span>{device}</span><strong>{dimensions}</strong><small>{note}</small></div>)}
      <p>Use JPG or WebP, keep text away from the edges and upload a separate mobile artwork whenever possible. Tablet and mobile fall back to the desktop image if omitted.</p>
    </section>
    <AdminActionForm action={addHomeBanner} className="admin-editor admin-banner-create" encType="multipart/form-data">
      <div className="admin-record-heading"><div><span>New banner</span><h2>Add artwork to the carousel</h2></div></div>
      <div className="admin-form-grid">
        <label>Internal title<input name="title" required placeholder="Summer concert campaign" /></label>
        <label>Image description<input name="alt_text" required placeholder="Accessible description of the artwork" /></label>
        <label htmlFor="banner-new-desktop">Desktop image · 1920 × 700<AdminImageInput id="banner-new-desktop" name="uploaded_desktop_image_url" bucket="home-banners" required /></label>
        <label htmlFor="banner-new-tablet">Tablet image · 1200 × 900<AdminImageInput id="banner-new-tablet" name="uploaded_tablet_image_url" bucket="home-banners" /></label>
        <label htmlFor="banner-new-mobile">Mobile image · 1080 × 1350<AdminImageInput id="banner-new-mobile" name="uploaded_mobile_image_url" bucket="home-banners" /></label>
        <label>Button text<input name="button_label" placeholder="View event" /></label>
        <label>Button destination<input name="button_url" placeholder="/events/event-slug or https://…" /></label>
        <label>Order<input name="sort_order" type="number" min="0" defaultValue="0" /></label>
        <label className="admin-check"><input name="active" type="checkbox" defaultChecked />Active on home</label>
      </div>
      <div className="admin-form-actions"><AdminSubmitButton pendingLabel="Uploading…">Create banner</AdminSubmitButton></div>
    </AdminActionForm>
    <section className="admin-banner-list">
      {banners.map((banner) => <AdminActionForm action={updateHomeBanner.bind(null, banner.id)} className="admin-record-card admin-banner-card" encType="multipart/form-data" key={banner.id}>
        <div className="admin-banner-preview"><Image src={banner.desktop_image_url} alt={banner.alt_text} fill sizes="(max-width: 900px) 100vw, 800px" /></div>
        <div className="admin-record-heading"><div><span>Banner {banner.sort_order}</span><h2>{banner.title}</h2></div><div><button className="admin-danger-button" formAction={deleteHomeBanner.bind(null, banner.id)} type="submit">Delete</button></div></div>
        <div className="admin-form-grid">
          <label>Internal title<input name="title" defaultValue={banner.title} required /></label>
          <label>Image description<input name="alt_text" defaultValue={banner.alt_text} required /></label>
          <label htmlFor={`banner-${banner.id}-desktop`}>Replace desktop image<AdminImageInput id={`banner-${banner.id}-desktop`} name="uploaded_desktop_image_url" bucket="home-banners" /></label>
          <label htmlFor={`banner-${banner.id}-tablet`}>Replace tablet image<AdminImageInput id={`banner-${banner.id}-tablet`} name="uploaded_tablet_image_url" bucket="home-banners" /></label>
          <label htmlFor={`banner-${banner.id}-mobile`}>Replace mobile image<AdminImageInput id={`banner-${banner.id}-mobile`} name="uploaded_mobile_image_url" bucket="home-banners" /></label>
          <label>Button text<input name="button_label" defaultValue={banner.button_label || ""} /></label>
          <label>Button destination<input name="button_url" defaultValue={banner.button_url || ""} /></label>
          <label>Order<input name="sort_order" type="number" min="0" defaultValue={banner.sort_order} /></label>
          <label className="admin-check"><input name="active" type="checkbox" defaultChecked={banner.active} />Active on home</label>
          {banner.tablet_image_url && <label className="admin-check"><input name="remove_tablet_image" type="checkbox" />Use desktop image on tablet</label>}
          {banner.mobile_image_url && <label className="admin-check"><input name="remove_mobile_image" type="checkbox" />Use fallback image on mobile</label>}
        </div>
        <div className="admin-form-actions"><AdminSubmitButton pendingLabel="Uploading…">Save changes</AdminSubmitButton></div>
      </AdminActionForm>)}
    </section>
    {!banners.length && <div className="admin-empty"><strong>No managed banners yet</strong><p>The home page will keep showing its current local banners until you create the first one.</p></div>}
  </>;
}
