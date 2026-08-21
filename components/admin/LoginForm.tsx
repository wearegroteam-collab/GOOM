"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { login } from "@/app/admin/login/actions";

export function LoginForm({ setupRequired = false, unauthorized = false }: { setupRequired?: boolean; unauthorized?: boolean }) {
  const [state, action, pending] = useActionState(login, { error: "" });
  return (
    <form action={action} className="admin-login-form">
      <div className="admin-login-mark"><LockKeyhole aria-hidden="true" /></div>
      <p className="admin-kicker">Private administration</p>
      <h1>Welcome back.</h1>
      <p className="admin-muted">Sign in with an administrator account created in Supabase.</p>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {(state.error || setupRequired || unauthorized) && <p className="admin-form-error" role="alert">{state.error || (setupRequired ? "Supabase setup is required before you can sign in." : "This account is not authorized as an administrator.")}</p>}
      <button className="admin-primary-button" type="submit" disabled={pending}>{pending ? "Signing in…" : "Login"}</button>
      <Link href="/">← Back to website</Link>
    </form>
  );
}
