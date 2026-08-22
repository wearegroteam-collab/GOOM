"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_ACCEPT, IMAGE_EXTENSIONS, validateImage } from "@/lib/image-rules";

type ImageBucket = "events" | "gallery" | "services" | "home-banners";

export function AdminImageInput({ id, name, bucket, required = false }: { id: string; name: string; bucket: ImageBucket; required?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [uploadedPath, setUploadedPath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function setFormBusy(busy: boolean) {
    const field = inputRef.current?.closest<HTMLElement>(".admin-image-upload");
    if (field) field.dataset.uploading = String(busy);
    const form = inputRef.current?.form;
    const anyUploading = Boolean(form?.querySelector('[data-uploading="true"]'));
    form?.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach((button) => { button.disabled = anyUploading; });
  }

  async function upload(file: File) {
    const validationError = validateImage(file);
    if (validationError) { setError(validationError); return; }
    setUploading(true);
    setError("");
    setFormBusy(true);
    try {
      const supabase = createClient();
      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[file.type]}`;
      const { error: storageError } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (storageError) throw storageError;
      const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      if (!publicUrl) throw new Error("Supabase did not return a public URL.");
      if (uploadedPath) await supabase.storage.from(bucket).remove([uploadedPath]);
      setUploadedPath(path);
      setUrl(publicUrl);
    } catch (technicalError) {
      if (process.env.NODE_ENV !== "production") console.error(`[GOOM image upload: ${bucket}]`, technicalError);
      setError("Unable to upload image. Please try again.");
    } finally {
      setUploading(false);
      setFormBusy(false);
    }
  }

  return <div className="admin-image-upload" data-uploading="false">
    <input ref={inputRef} id={id} type="file" accept={IMAGE_ACCEPT} required={required} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    <input type="hidden" name={name} value={url} />
    {uploading && <small className="admin-upload-status" role="status">Uploading…</small>}
    {error && <small className="admin-upload-error" role="alert">{error}</small>}
    {url && <div className="admin-upload-preview"><Image src={url} alt="Uploaded image preview" fill sizes="240px" /></div>}
  </div>;
}
