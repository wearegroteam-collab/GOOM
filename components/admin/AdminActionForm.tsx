"use client";

import type { ComponentProps, ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ImageFormState } from "@/lib/admin/storage";

type Action = (state: ImageFormState, formData: FormData) => Promise<ImageFormState>;

export function AdminActionForm({ action, children, ...props }: Omit<ComponentProps<"form">, "action"> & { action: Action; children: ReactNode }) {
  const [state, formAction] = useActionState(action, { success: false, error: "" });
  return <form {...props} action={formAction}>
    {children}
    {state.error && <p className="admin-form-error" role="alert" aria-live="polite">{state.error}</p>}
    {state.success && <p className="admin-form-success" role="status" aria-live="polite">Changes saved successfully.</p>}
  </form>;
}

export function AdminSubmitButton({ children, pendingLabel = "Uploading…", className = "admin-primary-button" }: { children: ReactNode; pendingLabel?: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending} type="submit">{pending ? pendingLabel : children}</button>;
}
