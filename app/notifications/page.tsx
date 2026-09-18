"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: number;
  type?: string | null;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

function getNotificationHref(
  notification: Notification,
) {
  const href = notification.href?.trim() ?? "";

  if (href.startsWith("/")) {
    return href;
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

export default function NotificationsPage() {
  const router = useRouter();

  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [markingId, setMarkingId] =
    useState<number | null>(null);

  const [markingAll, setMarkingAll] =
    useState(false);

  const unreadCount = notifications.filter(
    (notification) =>
      notification.read_at === null,
  ).length;

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    const supabase = createClient();

    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Bildirimleri görmek için giriş yapmalısın.");
      setNotifications([]);
      setLoading(false);
      return;
    }

    const { data, error: notificationsError } =
      await supabase
        .from("notifications")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

    if (notificationsError) {
      setError(
        notificationsError.message ||
          "Bildirimler yüklenirken bir hata oluştu.",
      );
      setNotifications([]);
      setLoading(false);
      return;
    }

    setNotifications((data ?? []) as Notification[]);
    setLoading(false);
  }

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  async function handleNotificationClick(
    notification: Notification,
  ) {
    if (markingId !== null || markingAll) {
      return;
    }

    const supabase = createClient();

    setMarkingId(notification.id);
    setError("");

    if (notification.read_at === null) {
      const { error: readError } = await supabase.rpc(
        "mark_notification_read",
        {
          p_notification_id: notification.id,
        },
      );

      if (readError) {
        setError(
          readError.message ||
            "Bildirim okundu olarak işaretlenemedi.",
        );
        setMarkingId(null);
        return;
      }
    }

    const href = getNotificationHref(notification);

    if (href) {
      try {
        router.push(href);
      } catch {
        setError(
          "Bu bildirim artık geçerli bir sayfaya yönlendirmiyor.",
        );
        setMarkingId(null);
      }
      return;
    }

    await loadNotifications();
    setMarkingId(null);
  }

  async function handleMarkAllRead() {
    const supabase = createClient();

    setMarkingAll(true);
    setError("");

    const { error: readAllError } = await supabase.rpc(
      "mark_all_notifications_read",
    );

    if (readAllError) {
      setError(
        readAllError.message ||
          "Bildirimler okundu olarak işaretlenemedi.",
      );
      setMarkingAll(false);
      return;
    }

    await loadNotifications();
    setMarkingAll(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-zinc-500">
            Bildirimler yükleniyor...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl pb-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Bildirimler
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Teklif ve mesaj güncellemelerin burada.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {markingAll
                ? "İşaretleniyor..."
                : "Tümünü okundu işaretle"}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
            <h2 className="text-lg font-medium text-zinc-900">
              Henüz bildirimin yok.
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Yeni teklif veya mesaj olduğunda burada
              görünecek.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const isUnread =
                notification.read_at === null;

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() =>
                    handleNotificationClick(
                      notification,
                    )
                  }
                  disabled={
                    markingId !== null || markingAll
                  }
                  className={`w-full rounded-2xl border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isUnread
                      ? "border-zinc-300 bg-zinc-100 hover:border-zinc-400"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      {notification.title}
                    </h2>

                    {isUnread && (
                      <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white">
                        Yeni
                      </span>
                    )}
                  </div>

                  {notification.body && (
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      {notification.body}
                    </p>
                  )}

                  <p className="mt-3 text-xs text-zinc-400">
                    {formatDateTime(
                      notification.created_at,
                    )}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
