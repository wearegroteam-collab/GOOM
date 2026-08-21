import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";
import type { Database } from "./types";

export async function updateSession(request: NextRequest) {
  const config = getSupabaseConfig();
  const isLogin = request.nextUrl.pathname === "/admin/login";
  if (!config) {
    return isLogin ? NextResponse.next() : NextResponse.redirect(new URL("/admin/login?setup=required", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    isAdmin = Boolean(data);
  }

  if (!user && !isLogin) return NextResponse.redirect(new URL("/admin/login", request.url));
  if (user && !isAdmin && !isLogin) {
    return NextResponse.redirect(new URL("/admin/login?error=not-admin", request.url));
  }
  if (user && isAdmin && isLogin) return NextResponse.redirect(new URL("/admin", request.url));
  return response;
}
