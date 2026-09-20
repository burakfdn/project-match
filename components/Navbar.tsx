"use client";

import { useEffect, useRef, useState } from "react";
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

  const [email, setEmail] = useState<string | null>(null);
  const [permissions, setPermissions] =
    useState<Permissions | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [previewUser, setPreviewUser] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
    if (!dropdownOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  function applySavedMode(nextPermissions: Permissions | null) {
    if (!nextPermissions) {
      setMode(null);
      return;
    }

    const savedMode = localStorage.getItem("project-match-mode");

    if (savedMode === "customer" && nextPermissions.customer_enabled) {
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
        .select("customer_enabled, provider_enabled, is_admin")
        .eq("id", user.id)
        .single();

      nextPermissions = profile ?? {
        customer_enabled: false,
        provider_enabled: false,
        is_admin: false,
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

  const customerEnabled = permissions?.customer_enabled ?? false;
  const providerEnabled = permissions?.provider_enabled ?? false;
  const isAdmin = permissions?.is_admin ?? false;
  const isCustomerMode = mode === "customer";
  const isProviderMode = mode === "provider";

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
            <>
              <Link
                href="/my-jobs"
                className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-950 sm:block"
              >
                İşlerim
              </Link>

              <Link
                href="/providers"
                className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-950 sm:block"
              >
                Uzmanlar
              </Link>
            </>
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
            href="/support"
            className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-950 sm:block"
          >
            Destek & Yardım
          </Link>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => toggleDropdown()}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-950"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <span>Bildirimler</span>

              {unreadCount > 0 ? (
                <span
                  className={`inline-flex h-[21px] items-center rounded-full bg-rose-50 px-2 text-[11px] font-medium leading-none text-rose-700 transition-transform duration-200 ${
                    badgePulse ? "scale-110" : "scale-100"
                  }`}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>

            {dropdownOpen ? (
              <div className="absolute right-0 z-50 mt-3 w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-xl border border-zinc-200 bg-white">
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
