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

  const publicPaths = [
    "/",
    "/login",
    "/signup",
    "/onboarding",
  ];

  if (!user) {
    if (!publicPaths.includes(pathname)) {
      return NextResponse.redirect(
        new URL("/login", request.url),
      );
    }

    return response;
  }

  const { data: permissionData, error: permissionError } =
    await supabase.rpc("get_my_permissions");

  if (permissionError) {
    return NextResponse.redirect(
      new URL("/", request.url),
    );
  }

  const permissionRow = Array.isArray(permissionData)
    ? permissionData[0]
    : permissionData;

  if (!permissionRow) {
    return NextResponse.redirect(
      new URL("/", request.url),
    );
  }

  const customerEnabled =
    permissionRow.customer_enabled ?? false;

  const providerEnabled =
    permissionRow.provider_enabled ?? false;

  const isAdmin =
    permissionRow.is_admin ?? false;

  if (
    pathname === "/login" ||
    pathname === "/signup"
  ) {
    return NextResponse.redirect(
      new URL("/", request.url),
    );
  }

  /*
   * Proje Sahibi rotaları
   *
   * /jobs/new özellikle burada tutuluyor.
   * Çünkü /jobs/new, /jobs altında olmasına rağmen
   * Uzman sayfası değildir.
   *
   * /jobs/[id]/edit de müşteri rotasıdır.
   * Sabit "/jobs/edit" kullanılmaz; id segmentinden sonra
   * "edit" gelen pathname yakalanır.
   */
  const customerRoutes = [
    "/jobs/new",
    "/my-jobs",
  ];

  const jobPathParts = pathname.split("/");
  const isJobEditRoute =
    jobPathParts[1] === "jobs" &&
    Boolean(jobPathParts[2]) &&
    jobPathParts[3] === "edit";

  const isCustomerRoute =
    customerRoutes.some(
      (route) =>
        pathname === route ||
        pathname.startsWith(`${route}/`),
    ) || isJobEditRoute;

  if (isCustomerRoute && !customerEnabled) {
    return NextResponse.redirect(
      new URL("/", request.url),
    );
  }

  /*
   * Uzman rotaları
   *
   * /jobs/new ve /jobs/[id]/edit burada özellikle
   * hariç tutuluyor.
   */
  const isProviderRoute =
    pathname === "/jobs" ||
    (
      pathname.startsWith("/jobs/") &&
      pathname !== "/jobs/new" &&
      !pathname.startsWith("/jobs/new/") &&
      !isJobEditRoute
    ) ||
    pathname === "/my-offers" ||
    pathname.startsWith("/my-offers/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/");

  if (isProviderRoute && !providerEnabled) {
    return NextResponse.redirect(
      new URL("/", request.url),
    );
  }

  const isAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(
      new URL("/", request.url),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};