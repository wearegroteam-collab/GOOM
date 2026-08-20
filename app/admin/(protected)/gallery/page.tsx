import Image from "next/image";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { createClient } from "@/lib/supabase/server";
import type { GalleryRecord } from "@/lib/supabase/types";
import { addGalleryImage, deleteGalleryImage, updateGalleryImage } from "./actions";

export default async function AdminGalleryPage() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.from("gallery").select("*").order("sort_order") : { data: [] };
  const items = (data || []) as GalleryRecord[];
  return <><AdminPageHeader eyebrow="Content" title="Gallery" description="Upload, feature and order the photographs shown publicly." /><form action={addGalleryImage} className="admin-upload-panel"><label>Image<input name="image" type="file" accept="image/*" required /></label><label>Caption<input name="caption" /></label><label>Order<input name="sort_order" type="number" min="0" defaultValue="0" /></label><label className="admin-check"><input name="featured" type="checkbox" />Featured</label><button className="admin-primary-button" type="submit">Upload image</button></form><section className="admin-gallery-grid">{items.map(item => <form action={updateGalleryImage.bind(null, item.id)} key={item.id}><div className="admin-gallery-image"><Image src={item.image_url} alt={item.caption || "Gallery image"} fill sizes="300px" /></div><label>Caption<input name="caption" defaultValue={item.caption || ""} /></label><label>Order<input name="sort_order" type="number" min="0" defaultValue={item.sort_order} /></label><div className="admin-gallery-checks"><label className="admin-check"><input name="active" type="checkbox" defaultChecked={item.active} />Active</label><label className="admin-check"><input name="featured" type="checkbox" defaultChecked={item.featured} />Featured</label></div><div><button className="admin-secondary-button" type="submit">Save</button><button className="admin-danger-button" formAction={deleteGalleryImage.bind(null, item.id, item.image_url)} type="submit">Delete</button></div></form>)}</section>{!items.length && <div className="admin-empty"><strong>No gallery images yet</strong><p>Upload the first image above or run the seed SQL.</p></div>}</>;
}
