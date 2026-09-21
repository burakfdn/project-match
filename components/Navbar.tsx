"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { clearPreviewUser, getPreviewUser } from "@/lib/preview";
import {
  ACTIVE_MODE_CHANGE_EVENT,
  persistActiveMode,
  resolveActiveMode,
  type ActiveMode,
} from "@/lib/active-mode";

type Mode = ActiveMode | null;

type Permissions = {
  customer_enabled: boolean;
  provider_enabled: boolean;
  is_admin: boolean;
  active_mode?: string | null;
  role?: string | null;
};

type Notification = {
  id: number;
  type: string | null;
  title: string;
  body: string | null;
  href: string | null;
  job_id: number | null;
  offer_id: number | null;
  conversation_id: number | null;
  created_at: string;
  read_at: string | null;
};

const PUBLIC_PATHS = ["/login", "/signup", "/onboarding"];
const DROPDOWN_LIMIT = 8;

const CUSTOMER_DISCOVER_ITEMS = [
  { href: "/providers", label: "Uzmanları Keşfet" },
  { href: "/jobs", label: "İşleri Keşfet" },
] as const;

const PROVIDER_DISCOVER_ITEMS = [
  { href: "/jobs", label: "İşleri Keşfet" },
] as const;

const CUSTOMER_MOBILE_NAV_ITEMS = [
  { href: "/my-jobs", label: "İşlerim" },
] as const;

const PROVIDER_MOBILE_NAV_ITEMS = [
  { href: "/my-offers", label: "Tekliflerim" },
  { href: "/profile", label: "Profilim" },
] as const;

function isDiscoverHrefActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ModeControl({
  mode,
  canSwitch,
  onSwitch,
  className,
  compact = false,
}: {
  mode: ActiveMode;
  canSwitch: boolean;
  onSwitch: (nextMode: ActiveMode) => void;
  className?: string;
  compact?: boolean;
}) {
  const label = mode === "customer" ? "Proje Sahibi" : "Uzman";
  const compactTone =
    mode === "customer"
      ? "border-violet-200 bg-violet-50 text-violet-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  if (compact) {
    const compactClassName = `inline-flex h-7 max-w-full items-center rounded-full border px-3 text-xs font-medium ${compactTone}`;

    if (!canSwitch) {
      return (
        <div className={className}>
          <div className={compactClassName} aria-label={label}>
            {label}
          </div>
        </div>
      );
    }

    return (
      <div className={className}>
        <button
          type="button"
          onClick={() =>
            onSwitch(mode === "customer" ? "provider" : "customer")
          }
          className={`${compactClassName} hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300`}
          aria-label={
            mode === "customer"
              ? "Uzman moduna geç"
              : "Proje Sahibi moduna geç"
          }
        >
          {label}
        </button>
      </div>
    );
  }

  const switchButton = (
    <button
      type="button"
      onClick={() =>
        onSwitch(mode === "customer" ? "provider" : "customer")
      }
      className={`relative h-7 w-[8.25rem] shrink-0 overflow-hidden rounded-full border transition-colors duration-[220ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 ${
        mode === "customer"
          ? "border-violet-200 bg-violet-50 hover:bg-violet-100/80"
          : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80"
      }`}
      aria-label={
        mode === "customer"
          ? "Uzman moduna geç"
          : "Proje Sahibi moduna geç"
      }
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-[3px] left-[3px] h-[22px] w-[22px] rounded-full shadow-sm transition-transform duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          mode === "provider"
            ? "translate-x-[6.5rem] bg-emerald-200"
            : "translate-x-0 bg-violet-200"
        }`}
      />
      <span
        className={`relative z-10 flex h-full items-center text-[11px] font-medium transition-[color,padding] duration-[220ms] ease-out ${
          mode === "customer"
            ? "justify-end pr-2.5 pl-8 text-violet-800"
            : "justify-start pl-2.5 pr-8 text-emerald-800"
        }`}
      >
        {mode === "customer" ? "Proje Sahibi" : "Uzman"}
      </span>
    </button>
  );

  const staticBadge = (
    <div
      className={`relative h-7 w-[8.25rem] shrink-0 overflow-hidden rounded-full border ${
        mode === "customer"
          ? "border-violet-200 bg-violet-50"
          : "border-emerald-200 bg-emerald-50"
      }`}
      aria-label={mode === "customer" ? "Proje Sahibi" : "Uzman"}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-[3px] left-[3px] h-[22px] w-[22px] rounded-full shadow-sm ${
          mode === "provider"
            ? "translate-x-[6.5rem] bg-emerald-200"
            : "translate-x-0 bg-violet-200"
        }`}
      />
      <span
        className={`relative z-10 flex h-full items-center text-[11px] font-medium ${
          mode === "customer"
            ? "justify-end pr-2.5 pl-8 text-violet-800"
            : "justify-start pl-2.5 pr-8 text-emerald-800"
        }`}
      >
        {mode === "customer" ? "Proje Sahibi" : "Uzman"}
      </span>
    </div>
  );

  return (
    <div className={className}>{canSwitch ? switchButton : staticBadge}</div>
  );
}

function getNotificationHref(notification: Notification) {
  const href = notification.href?.trim() ?? "";

  if (href.startsWith("/")) {
    return href;
  }

  if (notification.type === "project_invitation") {
    if (notification.job_id) {
      return `/jobs/${notification.job_id}`;
    }

    return null;
  }

  if (notification.type === "support_ticket_created") {
    return notification.href?.trim() || null;
  }

  if (notification.type === "offer_received") {
    return "/my-jobs";
  }

  if (
    notification.type === "offer_accepted" ||
    notification.type === "offer_rejected"
  ) {
    return "/my-offers";
  }

  return null;
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function excerptText(value: string, maxLength = 90) {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const discoverRef = useRef<HTMLDivElement>(null);
  const discoverMobileRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState<string | null>(null);
  const [permissions, setPermissions] =
    useState<Permissions | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [previewUser, setPreviewUser] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(
    [],
  );
  const [notificationsLoading, setNotificationsLoading] =
    useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [badgePulse, setBadgePulse] = useState(false);
  const previousUnreadCountRef = useRef<number | null>(null);

  useEffect(() => {
    setDropdownOpen(false);
    setDiscoverOpen(false);
    setMenuOpen(false);
    loadNavbar();
  }, [pathname]);

  useEffect(() => {
    function handleSupportUnreadRefresh() {
      void loadSupportUnreadCount();
      void loadNotificationUnreadCount();
    }

    window.addEventListener(
      "project-match-admin-support-unread",
      handleSupportUnreadRefresh,
    );

    return () => {
      window.removeEventListener(
        "project-match-admin-support-unread",
        handleSupportUnreadRefresh,
      );
    };
  }, []);

  useEffect(() => {
    function handleModeChange() {
      void loadNavbar();
    }

    window.addEventListener(
      ACTIVE_MODE_CHANGE_EVENT,
      handleModeChange,
    );

    return () => {
      window.removeEventListener(
        ACTIVE_MODE_CHANGE_EVENT,
        handleModeChange,
      );
    };
  }, []);

  useEffect(() => {
    const previousCount = previousUnreadCountRef.current;
    previousUnreadCountRef.current = unreadCount;

    if (previousCount === null || unreadCount <= previousCount || unreadCount === 0) {
      return;
    }

    setBadgePulse(true);

    const timeout = window.setTimeout(() => {
      setBadgePulse(false);
    }, 280);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [unreadCount]);

  useEffect(() => {
    if (!dropdownOpen && !discoverOpen && !menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        dropdownOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setDropdownOpen(false);
      }

      if (
        discoverOpen &&
        !discoverRef.current?.contains(target) &&
        !discoverMobileRef.current?.contains(target)
      ) {
        setDiscoverOpen(false);
      }

      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
        setDiscoverOpen(false);
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen, discoverOpen, menuOpen]);

  function applySavedMode(nextPermissions: Permissions | null) {
    if (!nextPermissions) {
      setMode(null);
      return;
    }

    setMode(
      resolveActiveMode({
        activeMode: nextPermissions.active_mode,
        role: nextPermissions.role,
        customerEnabled: nextPermissions.customer_enabled,
        providerEnabled: nextPermissions.provider_enabled,
      }),
    );
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
      setSupportUnreadCount(0);
      setReady(true);
      return;
    }

    const activePreviewUser = getPreviewUser();
    let nextPermissions: Permissions | null = null;

    if (activePreviewUser) {
      setPreviewUser(true);
      setEmail(activePreviewUser.email);

      nextPermissions = {
        customer_enabled: activePreviewUser.customer_enabled,
        provider_enabled: activePreviewUser.provider_enabled,
        is_admin: activePreviewUser.is_admin,
      };

      setPermissions(nextPermissions);
      applySavedMode(nextPermissions);
    } else {
      setPreviewUser(false);
      setEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("customer_enabled, provider_enabled, is_admin, active_mode, role")
        .eq("id", user.id)
        .single();

      nextPermissions = profile ?? {
        customer_enabled: false,
        provider_enabled: false,
        is_admin: false,
        active_mode: null,
        role: null,
      };

      setPermissions(nextPermissions);
      applySavedMode(nextPermissions);
    }

    await loadNotificationUnreadCount();

    if (!activePreviewUser && nextPermissions?.is_admin) {
      await loadSupportUnreadCount();
    } else {
      setSupportUnreadCount(0);
    }

    setReady(true);
  }

  async function loadNotificationUnreadCount() {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id")
      .is("read_at", null);

    setUnreadCount((data ?? []).length);
  }

  async function loadSupportUnreadCount() {
    if (getPreviewUser()) {
      setSupportUnreadCount(0);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      "admin_get_unread_support_ticket_count",
    );

    const count = Number(data);

    if (error || !Number.isFinite(count)) {
      return;
    }

    setSupportUnreadCount(count);
  }

  async function loadDropdownNotifications() {
    const supabase = createClient();

    setNotificationsLoading(true);

    const { data } = await supabase
      .from("notifications")
      .select(
        "id, type, title, body, href, job_id, offer_id, conversation_id, created_at, read_at",
      )
      .order("created_at", { ascending: false })
      .limit(DROPDOWN_LIMIT);

    setNotifications((data ?? []) as Notification[]);
    setNotificationsLoading(false);
  }

  async function toggleDropdown() {
    const nextOpen = !dropdownOpen;
    setDropdownOpen(nextOpen);
    setDiscoverOpen(false);
    setMenuOpen(false);

    if (nextOpen) {
      await loadDropdownNotifications();
    }
  }

  async function handleNotificationClick(notification: Notification) {
    if (markingId !== null || markingAll) {
      return;
    }

    const supabase = createClient();
    setMarkingId(notification.id);

    if (notification.read_at === null) {
      const { error: readError } = await supabase.rpc(
        "mark_notification_read",
        {
          p_notification_id: notification.id,
        },
      );

      if (readError) {
        setMarkingId(null);
        return;
      }

      setUnreadCount((current) => Math.max(0, current - 1));
    }

    const href = getNotificationHref(notification);
    setMarkingId(null);
    setDropdownOpen(false);

    if (href) {
      router.push(href);
    }
  }

  async function handleMarkAllRead() {
    if (markingAll) {
      return;
    }

    const supabase = createClient();
    setMarkingAll(true);

    const { error: readAllError } = await supabase.rpc(
      "mark_all_notifications_read",
    );

    if (readAllError) {
      setMarkingAll(false);
      return;
    }

    const now = new Date().toISOString();

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read_at: notification.read_at ?? now,
      })),
    );
    setUnreadCount(0);
    setMarkingAll(false);
  }

  async function switchActiveMode(nextMode: ActiveMode) {
    const canSwitchModes =
      (permissions?.customer_enabled ?? false) &&
      (permissions?.provider_enabled ?? false);

    if (!canSwitchModes) {
      return;
    }

    if (previewUser) {
      persistActiveMode(nextMode);
      setMode(nextMode);
      setDiscoverOpen(false);
      setMenuOpen(false);
      if (pathname !== "/") {
        router.push("/");
      }
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.rpc("set_my_active_mode", {
      p_mode: nextMode,
    });

    if (error) {
      console.error("set_my_active_mode", error);
      return;
    }

    persistActiveMode(nextMode);
    setMode(nextMode);
    setDiscoverOpen(false);
    setMenuOpen(false);
    setPermissions((current) =>
      current
        ? {
            ...current,
            active_mode: nextMode,
            customer_enabled:
              nextMode === "customer" ? true : current.customer_enabled,
            provider_enabled:
              nextMode === "provider" ? true : current.provider_enabled,
          }
        : current,
    );
    if (pathname !== "/") {
      router.push("/");
    }
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

  const isAdmin = permissions?.is_admin ?? false;
  const isCustomerMode = mode === "customer";
  const isProviderMode = mode === "provider";
  const canSwitchModes =
    (permissions?.customer_enabled ?? false) &&
    (permissions?.provider_enabled ?? false);
  const discoverItems = isCustomerMode
    ? CUSTOMER_DISCOVER_ITEMS
    : isProviderMode
      ? PROVIDER_DISCOVER_ITEMS
      : [];
  const mobileNavItems = isCustomerMode
    ? CUSTOMER_MOBILE_NAV_ITEMS
    : isProviderMode
      ? PROVIDER_MOBILE_NAV_ITEMS
      : [];
  const isDiscoverActive = discoverItems.some((item) =>
    isDiscoverHrefActive(pathname, item.href),
  );
  const isMobileNavActive = mobileNavItems.some((item) =>
    isDiscoverHrefActive(pathname, item.href),
  );

  return (
    <nav
      className={`relative border-b transition-colors ${
        isCustomerMode
          ? "border-violet-200"
          : isProviderMode
            ? "border-emerald-200"
            : "border-zinc-200"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-3 sm:gap-5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link
            href="/"
            className="shrink-0 text-base font-semibold tracking-tight sm:text-lg"
          >
            Project Match
          </Link>

          {mode === "customer" || mode === "provider" ? (
            <ModeControl
              mode={mode}
              canSwitch={canSwitchModes}
              onSwitch={(nextMode) => void switchActiveMode(nextMode)}
              className="hidden sm:block"
            />
          ) : null}
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-5">
          {discoverItems.length > 0 ? (
            <div className="relative hidden sm:block" ref={discoverRef}>
              <button
                type="button"
                onClick={() => {
                  setDiscoverOpen((open) => !open);
                  setDropdownOpen(false);
                  setMenuOpen(false);
                }}
                className={`shrink-0 text-sm font-medium ${
                  isDiscoverActive
                    ? "text-zinc-950"
                    : isMobileNavActive
                      ? "text-zinc-950 sm:text-zinc-600 sm:hover:text-zinc-950"
                      : "text-zinc-600 hover:text-zinc-950"
                }`}
                aria-expanded={discoverOpen}
                aria-haspopup="true"
              >
                Keşfet
              </button>

              {discoverOpen ? (
                <div className="fixed inset-x-4 z-50 mt-2 max-h-[min(24rem,70vh)] overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 sm:absolute sm:inset-x-auto sm:left-0 sm:right-auto sm:mt-3 sm:max-h-none sm:w-auto sm:min-w-[13.5rem] sm:overflow-visible">
                  {discoverItems.map((item) => {
                    const itemActive = isDiscoverHrefActive(
                      pathname,
                      item.href,
                    );

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setDiscoverOpen(false)}
                        className={`block px-4 py-3 text-sm sm:py-2.5 ${
                          itemActive
                            ? "font-medium text-zinc-950"
                            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}

                  {mobileNavItems.length > 0 ? (
                    <>
                      <div className="my-1 border-t border-zinc-100 sm:hidden" />
                      {mobileNavItems.map((item) => {
                        const itemActive = isDiscoverHrefActive(
                          pathname,
                          item.href,
                        );

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setDiscoverOpen(false)}
                            className={`block px-4 py-3 text-sm sm:hidden ${
                              itemActive
                                ? "font-medium text-zinc-950"
                                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                            }`}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === "customer" && (
            <Link
              href="/my-jobs"
              className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-950 sm:block"
            >
              İşlerim
            </Link>
          )}

          {mode === "provider" && (
            <>
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
              href="/admin"
              className="hidden items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-950 sm:inline-flex"
            >
              <span>Admin</span>
              {supportUnreadCount > 0 ? (
                <span className="inline-flex h-[21px] items-center rounded-full bg-zinc-900 px-2 text-[11px] font-medium leading-none text-white">
                  {supportUnreadCount > 99 ? "99+" : supportUnreadCount}
                </span>
              ) : null}
            </Link>
          )}

          <Link
            href="/account"
            className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-950 sm:block"
          >
            Hesap
          </Link>

          <Link
            href="/support"
            className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-950 sm:block"
          >
            Destek & Yardım
          </Link>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => toggleDropdown()}
              className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 sm:h-auto sm:w-auto sm:gap-1.5 sm:rounded-none sm:hover:bg-transparent"
              aria-label="Bildirimler"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <span className="hidden sm:inline">Bildirimler</span>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className="h-5 w-5 sm:hidden"
              >
                <path
                  d="M10 2.5a4.5 4.5 0 0 0-4.5 4.5c0 3.1-1.2 4.4-1.9 5.1-.2.2-.3.5-.1.8.2.3.5.4.8.4h11.4c.3 0 .6-.1.8-.4.2-.3.1-.6-.1-.8-.7-.7-1.9-2-1.9-5.1A4.5 4.5 0 0 0 10 2.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 16.2a2.1 2.1 0 0 0 4 0"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>

              {unreadCount > 0 ? (
                <span
                  className={`absolute top-0 right-0 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-50 px-1 text-[10px] font-medium leading-none text-rose-700 sm:static sm:h-[21px] sm:min-w-0 sm:px-2 sm:text-[11px] ${
                    badgePulse ? "scale-110" : "scale-100"
                  } transition-transform duration-200`}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>

            {dropdownOpen ? (
              <div className="fixed inset-x-4 z-50 mt-2 max-h-[min(24rem,70vh)] overflow-hidden rounded-xl border border-zinc-200 bg-white sm:absolute sm:inset-x-auto sm:right-0 sm:left-auto sm:mt-3 sm:w-96">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-900">
                      Bildirimler
                    </p>

                    {unreadCount > 0 ? (
                      <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white">
                        {unreadCount}
                      </span>
                    ) : null}
                  </div>

                  {unreadCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleMarkAllRead()}
                      disabled={markingAll}
                      className="text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
                    >
                      {markingAll
                        ? "İşaretleniyor..."
                        : "Tümünü okundu işaretle"}
                    </button>
                  ) : null}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notificationsLoading ? (
                    <p className="px-4 py-6 text-sm text-zinc-500">
                      Bildirimler yükleniyor...
                    </p>
                  ) : notifications.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-zinc-500">
                      Henüz bildirimin yok.
                    </p>
                  ) : (
                    notifications.map((notification, index) => {
                      const isUnread = notification.read_at === null;

                      return (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() =>
                            handleNotificationClick(notification)
                          }
                          disabled={markingId !== null || markingAll}
                          className={`w-full border-zinc-100 px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            index > 0 ? "border-t" : ""
                          } ${
                            isUnread
                              ? "bg-zinc-50 hover:bg-zinc-100"
                              : "bg-white hover:bg-zinc-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium text-zinc-900">
                              {notification.title}
                            </p>

                            {isUnread ? (
                              <span className="shrink-0 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-white">
                                Yeni
                              </span>
                            ) : null}
                          </div>

                          {notification.body ? (
                            <p className="mt-1 text-xs leading-5 text-zinc-500">
                              {excerptText(notification.body)}
                            </p>
                          ) : null}

                          <p className="mt-2 text-[11px] text-zinc-400">
                            {formatNotificationDate(notification.created_at)}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-zinc-100 px-4 py-3">
                  <Link
                    href="/notifications"
                    onClick={() => setDropdownOpen(false)}
                    className="text-sm font-medium text-zinc-700 hover:text-zinc-950"
                  >
                    Tüm bildirimleri gör →
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <span className="hidden text-sm text-zinc-500 lg:block">
            {email}
          </span>

          {!previewUser && (
            <button
              type="button"
              onClick={handleLogout}
              className="hidden rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 sm:inline-flex"
            >
              Çıkış Yap
            </button>
          )}

          <div className="relative sm:hidden" ref={menuRef}>
            <button
              type="button"
              onClick={() => {
                setMenuOpen((open) => !open);
                setDiscoverOpen(false);
                setDropdownOpen(false);
              }}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
              aria-label="Menü"
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className="h-5 w-5"
              >
                <path
                  d="M10 10.8a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M4.2 16.2c.8-2 3-3.2 5.8-3.2s5 1.2 5.8 3.2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            {menuOpen ? (
              <div className="fixed inset-x-4 z-50 mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 sm:absolute sm:inset-x-auto sm:right-0 sm:left-auto sm:w-56">
                <Link
                  href="/account"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-3 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                >
                  Hesap
                </Link>
                <Link
                  href="/support"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-3 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                >
                  Destek & Yardım
                </Link>
                {isAdmin && !previewUser ? (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                  >
                    Admin
                    {supportUnreadCount > 0 ? ` (${supportUnreadCount > 99 ? "99+" : supportUnreadCount})` : ""}
                  </Link>
                ) : null}
                {!previewUser ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void handleLogout();
                    }}
                    className="block w-full px-4 py-3 text-left text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                  >
                    Çıkış Yap
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        </div>

        {mode === "customer" || mode === "provider" ? (
          <div className="mt-2.5 flex items-center justify-between gap-3 sm:hidden">
            <ModeControl
              mode={mode}
              canSwitch={canSwitchModes}
              onSwitch={(nextMode) => void switchActiveMode(nextMode)}
              compact
            />

            {discoverItems.length > 0 ? (
              <div className="relative" ref={discoverMobileRef}>
                <button
                  type="button"
                  onClick={() => {
                    setDiscoverOpen((open) => !open);
                    setDropdownOpen(false);
                    setMenuOpen(false);
                  }}
                  className={`shrink-0 text-sm font-medium ${
                    isDiscoverActive || isMobileNavActive
                      ? "text-zinc-950"
                      : "text-zinc-600"
                  }`}
                  aria-expanded={discoverOpen}
                  aria-haspopup="true"
                >
                  Keşfet
                </button>

                {discoverOpen ? (
                  <div className="fixed inset-x-4 z-50 mt-2 max-h-[min(24rem,70vh)] overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1">
                    {discoverItems.map((item) => {
                      const itemActive = isDiscoverHrefActive(
                        pathname,
                        item.href,
                      );

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setDiscoverOpen(false)}
                          className={`block px-4 py-3 text-sm ${
                            itemActive
                              ? "font-medium text-zinc-950"
                              : "text-zinc-600"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}

                    {mobileNavItems.length > 0 ? (
                      <>
                        <div className="my-1 border-t border-zinc-100" />
                        {mobileNavItems.map((item) => {
                          const itemActive = isDiscoverHrefActive(
                            pathname,
                            item.href,
                          );

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setDiscoverOpen(false)}
                              className={`block px-4 py-3 text-sm ${
                                itemActive
                                  ? "font-medium text-zinc-950"
                                  : "text-zinc-600"
                              }`}
                            >
                              {item.label}
                            </Link>
                          );
                        })}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
