import { LoginForm } from "@/components/admin/LoginForm";

export const metadata = { title: "Admin Login", robots: { index: false, follow: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ setup?: string; error?: string }> }) {
  const { setup, error } = await searchParams;
  return <main className="admin-shell admin-login-page"><div className="admin-login-brand"><strong>GOOM</strong><span>CONTENT STUDIO</span></div><LoginForm setupRequired={setup === "required"} unauthorized={error === "not-admin"} /></main>;
}
