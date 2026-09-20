"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getPreviewUser } from "@/lib/preview";
import { jobHref } from "@/lib/jobs/public-id";

type TicketCategory =
  | "job"
  | "offer"
  | "messaging"
  | "account"
  | "payment"
  | "technical"
  | "other";

type TicketPriority = "low" | "normal" | "high" | "urgent";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

type MessageVisibility = "user" | "internal";

type AdminSupportTicket = {
  id: number;
  created_at: string;
  updated_at: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  related_job_id: number | null;
  assigned_admin_id: string | null;
  assigned_admin_name: string | null;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  job_title: string | null;
  job_public_id: string | null;
};

type AdminSupportMessage = {
  id: number;
  created_at: string;
  sender_id: string;
  sender_name: string | null;
  message: string;
  visibility: MessageVisibility | string;
};

type SupportAdmin = {
  id: string;
  full_name: string | null;
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  job: "İş",
  offer: "Teklif",
  messaging: "Mesajlaşma",
  account: "Hesap / Profil",
  payment: "Ödeme / Ücret",
  technical: "Teknik",
  other: "Diğer",
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Açık",
  in_progress: "İnceleniyor",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClass(status: TicketStatus) {
  switch (status) {
    case "open":
      return "bg-emerald-50 text-emerald-700";
    case "in_progress":
      return "bg-blue-50 text-blue-700";
    case "resolved":
      return "bg-zinc-100 text-zinc-600";
    case "closed":
      return "bg-zinc-100 text-zinc-500";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

export default function AdminSupportTicketPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  const ticketId =
    typeof params.id === "string" ? params.id : "";

  const [ticket, setTicket] = useState<AdminSupportTicket | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [admins, setAdmins] = useState<SupportAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);

  const [draftStatus, setDraftStatus] = useState<TicketStatus>("open");
  const [draftPriority, setDraftPriority] = useState<TicketPriority>("normal");
  const [draftAssignedAdminId, setDraftAssignedAdminId] = useState("");

  const [replyMessage, setReplyMessage] = useState("");
  const [replyVisibility, setReplyVisibility] =
    useState<MessageVisibility>("user");

  useEffect(() => {
    loadPage();
  }, [ticketId]);

  async function loadPage() {
    setLoading(true);
    setError("");
    setNotFound(false);

    if (getPreviewUser()) {
      router.replace("/");
      return;
    }

    const { data: permissionData, error: permissionError } =
      await supabase.rpc("get_my_permissions");

    if (permissionError) {
      router.replace("/");
      return;
    }

    const permissionRow = Array.isArray(permissionData)
      ? permissionData[0]
      : permissionData;

    if (!permissionRow?.is_admin) {
      router.replace("/");
      return;
    }

    if (!ticketId || !/^\d+$/.test(ticketId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const { data: adminData } = await supabase.rpc(
      "admin_list_support_admins",
    );

    setAdmins((adminData ?? []) as SupportAdmin[]);

    const loaded = await refreshTicket();

    if (loaded) {
      const { error: markError } = await supabase.rpc(
        "admin_mark_support_ticket_read",
        {
          p_ticket_id: Number(ticketId),
        },
      );

      if (!markError) {
        window.dispatchEvent(
          new Event("project-match-admin-support-unread"),
        );
      }
    }

    setLoading(false);
  }

  async function refreshTicket() {
    const { data, error: ticketError } = await supabase.rpc(
      "admin_get_support_ticket",
      {
        p_ticket_id: Number(ticketId),
      },
    );

    if (ticketError) {
      console.error("Admin support ticket error:", ticketError);
      setError(
        ticketError.message ||
          "Destek talebi yüklenirken bir hata oluştu.",
      );
      setTicket(null);
      return false;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      setNotFound(true);
      setTicket(null);
      return false;
    }

    const loadedTicket = row as AdminSupportTicket;
    setTicket(loadedTicket);
    setDraftStatus(loadedTicket.status);
    setDraftPriority(loadedTicket.priority);
    setDraftAssignedAdminId(loadedTicket.assigned_admin_id ?? "");

    const { data: messageData, error: messagesError } = await supabase.rpc(
      "admin_list_support_ticket_messages",
      {
        p_ticket_id: Number(ticketId),
      },
    );

    if (messagesError) {
      console.error("Admin support messages error:", messagesError);
      setError(
        messagesError.message ||
          "Mesajlar yüklenirken bir hata oluştu.",
      );
      setMessages([]);
      return false;
    }

    setMessages((messageData ?? []) as AdminSupportMessage[]);
    return true;
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();

    if (!ticket || saving) {
      return;
    }

    setSaving(true);
    setActionError("");

    const { error: sendError } = await supabase.rpc(
      "admin_add_support_ticket_message",
      {
        p_ticket_id: ticket.id,
        p_message: replyMessage,
        p_visibility: replyVisibility,
      },
    );

    if (sendError) {
      setActionError(
        sendError.message || "Mesaj gönderilirken bir hata oluştu.",
      );
      setSaving(false);
      return;
    }

    setReplyMessage("");
    await refreshTicket();
    setSaving(false);
  }

  async function handleSaveStatus() {
    if (!ticket || savingStatus || draftStatus === ticket.status) {
      return;
    }

    const previousStatus = ticket.status;
    setSavingStatus(true);
    setActionError("");
    setActionSuccess("");

    const { error: statusError } = await supabase.rpc(
      "admin_update_support_ticket_status",
      {
        p_ticket_id: ticket.id,
        p_status: draftStatus,
      },
    );

    if (statusError) {
      setActionError(
        statusError.message || "Durum güncellenirken bir hata oluştu.",
      );
      setDraftStatus(previousStatus);
      setSavingStatus(false);
      return;
    }

    await refreshTicket();
    setActionSuccess("Durum güncellendi.");
    setSavingStatus(false);
  }

  async function handleSavePriority() {
    if (!ticket || savingPriority || draftPriority === ticket.priority) {
      return;
    }

    const previousPriority = ticket.priority;
    setSavingPriority(true);
    setActionError("");
    setActionSuccess("");

    const { error: priorityError } = await supabase.rpc(
      "admin_update_support_ticket_priority",
      {
        p_ticket_id: ticket.id,
        p_priority: draftPriority,
      },
    );

    if (priorityError) {
      setActionError(
        priorityError.message || "Öncelik güncellenirken bir hata oluştu.",
      );
      setDraftPriority(previousPriority);
      setSavingPriority(false);
      return;
    }

    await refreshTicket();
    setActionSuccess("Öncelik güncellendi.");
    setSavingPriority(false);
  }

  async function handleSaveAssign() {
    if (!ticket || savingAssign) {
      return;
    }

    const assignedId = draftAssignedAdminId || null;
    const previousAssignedId = ticket.assigned_admin_id ?? "";

    if ((ticket.assigned_admin_id || null) === assignedId) {
      return;
    }

    setSavingAssign(true);
    setActionError("");
    setActionSuccess("");

    const { error: assignError } = await supabase.rpc(
      "admin_assign_support_ticket",
      {
        p_ticket_id: ticket.id,
        p_admin_id: assignedId,
      },
    );

    if (assignError) {
      setActionError(
        assignError.message || "Atama güncellenirken bir hata oluştu.",
      );
      setDraftAssignedAdminId(previousAssignedId);
      setSavingAssign(false);
      return;
    }

    await refreshTicket();
    setActionSuccess(
      assignedId ? "Admin ataması kaydedildi." : "Admin ataması kaldırıldı.",
    );
    setSavingAssign(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-zinc-500">Destek talebi yükleniyor...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight"
          >
            Project Match
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              Admin Paneli
            </Link>
            <Link
              href="/admin/users"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              Kullanıcılar
            </Link>
            <Link
              href="/admin/support"
              className="text-sm font-medium text-zinc-950"
            >
              Destek Talepleri
            </Link>
            <Link
              href="/admin/activity"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              Aktivite Arşivi
            </Link>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
              Admin Paneli
            </span>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <Link
          href="/admin/support"
          className="mb-6 inline-block text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          ← Destek Talepleri
        </Link>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {notFound || !ticket ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
            <p className="text-sm text-zinc-700">Destek talebi bulunamadı.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs text-zinc-400">Ticket #{ticket.id}</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                    {ticket.subject}
                  </h1>
                  <p className="mt-2 text-sm text-zinc-500">
                    {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                    {" · "}
                    {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                    ticket.status,
                  )}`}
                >
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </span>
              </div>

              <dl className="mt-6 space-y-2 text-sm text-zinc-600">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-400">Kullanıcı</dt>
                  <dd>
                    <Link
                      href={`/admin/users/${ticket.user_id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {ticket.user_name || "İsimsiz kullanıcı"}
                    </Link>
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-400">E-posta</dt>
                  <dd>{ticket.user_email || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-400">Oluşturulma</dt>
                  <dd>{formatDateTime(ticket.created_at)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-400">Güncellenme</dt>
                  <dd>{formatDateTime(ticket.updated_at)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-400">İlgili iş</dt>
                  <dd className="text-right">
                    {ticket.job_public_id && ticket.job_title ? (
                      <Link
                        href={jobHref({
                          id: ticket.related_job_id ?? 0,
                          public_id: ticket.job_public_id,
                        })}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {ticket.job_title}
                      </Link>
                    ) : ticket.job_title ? (
                      ticket.job_title
                    ) : ticket.related_job_id ? (
                      `İş #${ticket.related_job_id}`
                    ) : (
                      "Seçilmedi"
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 border-t border-zinc-100 pt-5">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Açıklama
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                  {ticket.description}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
              <h2 className="text-sm font-semibold text-zinc-900">
                Ticket işlemleri
              </h2>

              {actionError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {actionError}
                </div>
              ) : null}

              {actionSuccess ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {actionSuccess}
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="text-sm">
                  <p className="text-xs font-medium text-zinc-500">Durum</p>
                  <p className="mt-1 font-medium text-zinc-900">
                    {STATUS_LABELS[ticket.status] ?? ticket.status}
                  </p>
                  <label className="mt-4 block">
                    <span className="mb-1 block text-xs font-medium text-zinc-500">
                      Durumu değiştir
                    </span>
                    <select
                      value={draftStatus}
                      disabled={savingStatus}
                      onChange={(event) =>
                        setDraftStatus(event.target.value as TicketStatus)
                      }
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                    >
                      <option value="open">Açık</option>
                      <option value="in_progress">İşlemde</option>
                      <option value="resolved">Çözüldü</option>
                      <option value="closed">Kapalı</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={savingStatus || draftStatus === ticket.status}
                    onClick={() => void handleSaveStatus()}
                    className="mt-2 w-full rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingStatus ? "Kaydediliyor..." : "Durumu kaydet"}
                  </button>
                </div>

                <div className="text-sm">
                  <p className="text-xs font-medium text-zinc-500">
                    Mevcut öncelik
                  </p>
                  <p className="mt-1 font-medium text-zinc-900">
                    {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                  </p>
                  <label className="mt-4 block">
                    <span className="mb-1 block text-xs font-medium text-zinc-500">
                      Önceliği değiştir
                    </span>
                    <select
                      value={draftPriority}
                      disabled={savingPriority}
                      onChange={(event) =>
                        setDraftPriority(
                          event.target.value as TicketPriority,
                        )
                      }
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                    >
                      <option value="low">Düşük</option>
                      <option value="normal">Normal</option>
                      <option value="high">Yüksek</option>
                      <option value="urgent">Acil</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={
                      savingPriority || draftPriority === ticket.priority
                    }
                    onClick={() => void handleSavePriority()}
                    className="mt-2 w-full rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingPriority ? "Kaydediliyor..." : "Önceliği kaydet"}
                  </button>
                </div>

                <div className="text-sm">
                  <p className="text-xs font-medium text-zinc-500">
                    Atanan admin
                  </p>
                  <p className="mt-1 font-medium text-zinc-900">
                    {ticket.assigned_admin_name || "Atanmamış"}
                  </p>
                  <label className="mt-4 block">
                    <span className="mb-1 block text-xs font-medium text-zinc-500">
                      Atamayı değiştir
                    </span>
                    <select
                      value={draftAssignedAdminId}
                      disabled={savingAssign}
                      onChange={(event) =>
                        setDraftAssignedAdminId(event.target.value)
                      }
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                    >
                      <option value="">Atanmamış</option>
                      {ticket.assigned_admin_id &&
                      !admins.some(
                        (admin) => admin.id === ticket.assigned_admin_id,
                      ) ? (
                        <option value={ticket.assigned_admin_id}>
                          {ticket.assigned_admin_name || "İsimsiz admin"}
                        </option>
                      ) : null}
                      {admins.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          {admin.full_name || "İsimsiz admin"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={
                      savingAssign ||
                      draftAssignedAdminId === (ticket.assigned_admin_id ?? "")
                    }
                    onClick={() => void handleSaveAssign()}
                    className="mt-2 w-full rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingAssign ? "Kaydediliyor..." : "Atamayı kaydet"}
                  </button>
                </div>
              </div>
            </div>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900">Mesajlar</h2>

              {messages.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                  <p className="text-sm text-zinc-500">
                    Bu talepte henüz mesaj yok.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {messages.map((item) => {
                    const isInternal = item.visibility === "internal";

                    return (
                      <article
                        key={item.id}
                        className={`rounded-2xl border px-4 py-3 ${
                          isInternal
                            ? "border-amber-200 bg-amber-50"
                            : "border-zinc-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-zinc-500">
                            {item.sender_name || "İsimsiz kullanıcı"}
                            {" · "}
                            {formatDateTime(item.created_at)}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              isInternal
                                ? "bg-amber-100 text-amber-800"
                                : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {isInternal ? "Internal not" : "user"}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                          {item.message}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}

              <form
                onSubmit={handleSendMessage}
                className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5"
              >
                <p className="text-sm font-semibold text-zinc-900">
                  Mesaj yaz
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setReplyVisibility("user")}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      replyVisibility === "user"
                        ? "bg-zinc-950 text-white"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    Kullanıcıya cevap
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyVisibility("internal")}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      replyVisibility === "internal"
                        ? "bg-amber-700 text-white"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    Internal not
                  </button>
                </div>

                <textarea
                  value={replyMessage}
                  onChange={(event) => setReplyMessage(event.target.value)}
                  rows={4}
                  required
                  className="mt-4 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                  placeholder={
                    replyVisibility === "internal"
                      ? "Yalnızca adminlerin göreceği not..."
                      : "Kullanıcıya gönderilecek cevap..."
                  }
                />

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving || !replyMessage.trim()}
                    className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Gönderiliyor..." : "Gönder"}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
