import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Giriş yapmamış kullanıcı
  if (!user) {
    const publicPaths = ["/", "/login", "/signup"];

    if (!publicPaths.includes(pathname) && pathname !== "/onboarding") {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return response;
  }

  // Giriş yapmış kullanıcı
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  // Rolü olmayan kullanıcı onboarding'e gider
  if (!role && pathname !== "/onboarding") {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Onboarding'i tamamlamış kullanıcı onboarding'e tekrar gidemez
  if (role && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Customer-only sayfalar
  const customerPaths = ["/jobs/new", "/my-jobs"];

  if (customerPaths.includes(pathname) && role !== "customer") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Provider-only sayfalar
  const providerPaths = ["/jobs", "/profile"];

  if (providerPaths.includes(pathname) && role !== "provider") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};