"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
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

type SupportTicket = {
  id: number;
  created_at: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  related_job_id: number | null;
};

type TicketMessage = {
  id: number;
  created_at: string;
  sender_id: string;
  message: string;
  visibility: string;
};

type RelatedJob = {
  id: number;
  public_id: string | null;
  title: string;
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  job: "İşimle ilgili sorun",
  offer: "Teklifle ilgili sorun",
  messaging: "Mesajlaşma sorunu",
  account: "Hesap / profil",
  payment: "Ödeme / ücret",
  technical: "Teknik sorun",
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

export default function SupportTicketDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  const ticketId =
    typeof params.id === "string" ? params.id : "";

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [relatedJob, setRelatedJob] = useState<RelatedJob | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  async function loadTicket() {
    setLoading(true);
    setError("");
    setNotFound(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setCurrentUserId(user.id);

    if (!ticketId || !/^\d+$/.test(ticketId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const { data: ticketRow, error: ticketError } = await supabase
      .from("admin_support_tickets")
      .select(
        "id, created_at, subject, description, category, priority, status, related_job_id",
      )
      .eq("id", Number(ticketId))
      .eq("user_id", user.id)
      .maybeSingle();

    if (ticketError) {
      setError(
        ticketError.message ||
          "Destek talebi yüklenirken bir hata oluştu.",
      );
      setTicket(null);
      setLoading(false);
      return;
    }

    if (!ticketRow) {
      setNotFound(true);
      setTicket(null);
      setLoading(false);
      return;
    }

    const loadedTicket = ticketRow as SupportTicket;
    setTicket(loadedTicket);

    await loadMessages(loadedTicket.id);
    await markTicketReplyNotificationsRead(loadedTicket.id, user.id);

    if (loadedTicket.related_job_id) {
      const { data: jobRow } = await supabase
        .from("jobs")
        .select("id, public_id, title")
        .eq("id", loadedTicket.related_job_id)
        .maybeSingle();

      setRelatedJob((jobRow as RelatedJob | null) ?? null);
    } else {
      setRelatedJob(null);
    }

    setLoading(false);
  }

  async function loadMessages(id: number) {
    const { data: messageRows, error: messagesError } = await supabase
      .from("admin_support_ticket_messages")
      .select("id, created_at, sender_id, message, visibility")
      .eq("ticket_id", id)
      .eq("visibility", "user")
      .order("created_at", { ascending: true });

    if (messagesError) {
      setError(
        messagesError.message ||
          "Mesajlar yüklenirken bir hata oluştu.",
      );
      setMessages([]);
      return;
    }

    setMessages(
      ((messageRows ?? []) as TicketMessage[]).filter(
        (item) => item.visibility === "user",
      ),
    );
  }

  async function markTicketReplyNotificationsRead(
    id: number,
    userId: string,
  ) {
    const { data } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "support_reply")
      .is("read_at", null)
      .eq("metadata->>ticket_id", String(id));

    await Promise.all(
      (data ?? []).map((row) =>
        supabase.rpc("mark_notification_read", {
          p_notification_id: row.id,
        }),
      ),
    );

    window.dispatchEvent(
      new Event("project-match-admin-support-unread"),
    );
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();

    if (!ticket || sending) {
      return;
    }

    const trimmed = replyMessage.trim();

    if (!trimmed) {
      return;
    }

    setSending(true);
    setSendError("");

    const { error: sendRpcError } = await supabase.rpc(
      "add_support_ticket_message",
      {
        p_ticket_id: ticket.id,
        p_message: trimmed,
      },
    );

    if (sendRpcError) {
      setSendError(
        sendRpcError.message || "Mesaj gönderilirken bir hata oluştu.",
      );
      setSending(false);
      return;
    }

    setReplyMessage("");
    await loadMessages(ticket.id);
    setSending(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-zinc-500">Destek talebi yükleniyor...</p>
        </div>
      </main>
    );
  }

  if (notFound || !ticket) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/support"
            className="mb-6 inline-block text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
          >
            ← Destek & Yardım
          </Link>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <p className="text-sm text-zinc-700">Destek talebi bulunamadı.</p>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl pb-8">
        <Link
          href="/support"
          className="mb-6 inline-block text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          ← Destek & Yardım
        </Link>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
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
              <dt className="text-zinc-400">Oluşturulma</dt>
              <dd>{formatDateTime(ticket.created_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-400">İlgili iş</dt>
              <dd className="text-right">
                {relatedJob ? (
                  <Link
                    href={jobHref(relatedJob)}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {relatedJob.title}
                  </Link>
                ) : ticket.related_job_id ? (
                  `İş #${ticket.related_job_id}`
                ) : (
                  "Seçilmedi"
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-6 border-t border-zinc-100 pt-5">
            <h2 className="text-sm font-semibold text-zinc-900">Açıklama</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
              {ticket.description}
            </p>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">Mesajlar</h2>

          {messages.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
              <p className="text-sm text-zinc-500">
                Bu talepte henüz görüntülenebilir mesaj yok.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {messages.map((item) => {
                const isOwn = item.sender_id === currentUserId;

                return (
                  <article
                    key={item.id}
                    className={`max-w-[85%] rounded-2xl border px-4 py-3 ${
                      isOwn
                        ? "ml-auto border-zinc-900 bg-zinc-950 text-white"
                        : "mr-auto border-zinc-200 bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    <p
                      className={`text-xs ${
                        isOwn ? "text-zinc-400" : "text-zinc-400"
                      }`}
                    >
                      {isOwn ? "Sen" : "Destek ekibi"}
                      {" · "}
                      {formatDateTime(item.created_at)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {item.message}
                    </p>
                  </article>
                );
              })}
            </div>
          )}

          {ticket.status === "closed" ? (
            <p className="mt-6 text-sm text-zinc-500">
              Bu talep kapatıldığı için mesaj gönderilemez.
            </p>
          ) : (
            <form
              onSubmit={handleSendMessage}
              className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5"
            >
              {sendError ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {sendError}
                </div>
              ) : null}

              <textarea
                value={replyMessage}
                onChange={(event) => setReplyMessage(event.target.value)}
                rows={4}
                required
                disabled={sending}
                className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500"
                placeholder="Mesajınızı yazın..."
              />

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={sending || !replyMessage.trim()}
                  className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? "Gönderiliyor..." : "Gönder"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
