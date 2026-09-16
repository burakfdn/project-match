"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { clearPreviewUser, getPreviewUser } from "@/lib/preview";

type Mode = "customer" | "provider" | null;

type Permissions = {
  customer_enabled: boolean;
  provider_enabled: boolean;
  is_admin: boolean;
};

const PUBLIC_PATHS = ["/login", "/signup", "/onboarding"];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [email, setEmail] = useState<string | null>(null);
  const [permissions, setPermissions] =
    useState<Permissions | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [previewUser, setPreviewUser] = useState(
    false,
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadNavbar();
  }, [pathname]);

  useEffect(() => {
    function handleModeChange() {
      applySavedMode(permissions);
    }

    window.addEventListener(
      "project-match-mode-change",
      handleModeChange,
    );

    return () => {
      window.removeEventListener(
        "project-match-mode-change",
        handleModeChange,
      );
    };
  }, [permissions]);

  function applySavedMode(
    nextPermissions: Permissions | null,
  ) {
    if (!nextPermissions) {
      setMode(null);
      return;
    }

    const savedMode = localStorage.getItem(
      "project-match-mode",
    );

    if (
      savedMode === "customer" &&
      nextPermissions.customer_enabled
    ) {
      setMode("customer");
    } else if (
      savedMode === "provider" &&
      nextPermissions.provider_enabled
    ) {
      setMode("provider");
    } else if (
      nextPermissions.provider_enabled &&
      !nextPermissions.customer_enabled
    ) {
      setMode("provider");
    } else if (
      nextPermissions.customer_enabled &&
      !nextPermissions.provider_enabled
    ) {
      setMode("customer");
    } else {
      setMode(null);
    }
  }

  async function loadNavbar() {
    if (PUBLIC_PATHS.includes(pathname)) {
      setReady(true);
      setEmail(null);
      return;
    }

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setEmail(null);
      setPermissions(null);
      setMode(null);
      setPreviewUser(false);
      setUnreadCount(0);
      setReady(true);
      return;
    }

    const activePreviewUser = getPreviewUser();

    if (activePreviewUser) {
      setPreviewUser(true);
      setEmail(activePreviewUser.email);

      const previewPermissions: Permissions = {
        customer_enabled:
          activePreviewUser.customer_enabled,
        provider_enabled:
          activePreviewUser.provider_enabled,
        is_admin: activePreviewUser.is_admin,
      };

      setPermissions(previewPermissions);
      applySavedMode(previewPermissions);
    } else {
      setPreviewUser(false);
      setEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "customer_enabled, provider_enabled, is_admin",
        )
        .eq("id", user.id)
        .single();

      const userPermissions: Permissions = profile ?? {
        customer_enabled: false,
        provider_enabled: false,
        is_admin: false,
      };

      setPermissions(userPermissions);
      applySavedMode(userPermissions);
    }

    const { data } = await supabase
      .from("notifications")
      .select("id")
      .is("read_at", null);

    setUnreadCount((data ?? []).length);
    setReady(true);
  }

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    clearPreviewUser();

    router.push("/login");
    router.refresh();
  }

  if (!ready || PUBLIC_PATHS.includes(pathname) || !email) {
    return null;
  }

  const customerEnabled =
    permissions?.customer_enabled ?? false;

  const providerEnabled =
    permissions?.provider_enabled ?? false;

  const isAdmin = permissions?.is_admin ?? false;

  const isCustomerMode = mode === "customer";
  const isProviderMode = mode === "provider";

  return (
    <nav
      className={`border-b transition-colors ${
        isCustomerMode
          ? "border-violet-200"
          : isProviderMode
            ? "border-emerald-200"
            : "border-zinc-200"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight"
          >
            Project Match
          </Link>

          {mode === "customer" && (
            <span className="hidden rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 sm:inline-flex">
              ● Proje Sahibi Modu
            </span>
          )}

          {mode === "provider" && (
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:inline-flex">
              ● Uzman Modu
            </span>
          )}
        </div>

        <div className="flex items-center gap-5">
          {customerEnabled && (
            <Link
              href="/my-jobs"
              className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-950 sm:block"
            >
              İşlerim
            </Link>
          )}

          {providerEnabled && (
            <>
              <Link
                href="/jobs"
                className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-950 sm:block"
              >
                Uygun İşler
              </Link>

              <Link
                href="/my-offers"
                className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-950 sm:block"
              >
                Tekliflerim
              </Link>

              <Link
                href="/profile"
                className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-950 sm:block"
              >
                Profilim
              </Link>
            </>
          )}

          {isAdmin && !previewUser && (
            <Link
              href="/admin/users"
              className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-950 sm:block"
            >
              Admin
            </Link>
          )}

          <Link
            href="/notifications"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-950"
          >
            <span>🔔 Bildirimler</span>

            {unreadCount > 0 && (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">
                {unreadCount}
              </span>
            )}
          </Link>

          <span className="hidden text-sm text-zinc-500 lg:block">
            {email}
          </span>

          {!previewUser && (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Çıkış Yap
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
