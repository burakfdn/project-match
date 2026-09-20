"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getPreviewUser } from "@/lib/preview";

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

type AdminSupportTicket = {
  id: number;
  created_at: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  related_job_id: number | null;
  user_id: string;
  user_name: string | null;
  job_title: string | null;
  job_public_id: string | null;
  is_unread?: boolean;
};

const PAGE_SIZE = 50;

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
    month: "short",
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

export default function AdminSupportPage() {
  const supabase = createClient();
  const router = useRouter();

  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    checkAccessAndLoad();
  }, []);

  async function checkAccessAndLoad() {
    if (getPreviewUser()) {
      router.replace("/");
      return;
    }

    const { data, error: permissionError } = await supabase.rpc(
      "get_my_permissions",
    );

    if (permissionError) {
      router.replace("/");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row?.is_admin) {
      router.replace("/");
      return;
    }

    await loadTickets(0);
  }

  async function loadTickets(nextOffset: number) {
    setLoading(true);
    setError("");

    const { data, error: listError } = await supabase.rpc(
      "admin_list_support_tickets",
      {
        p_limit: PAGE_SIZE,
        p_offset: nextOffset,
        p_status: status || null,
        p_priority: priority || null,
        p_category: category || null,
      },
    );

    if (listError) {
      console.error("Admin support list error:", listError);
      setError(
        listError.message ||
          "Destek talepleri yüklenirken bir hata oluştu.",
      );
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as AdminSupportTicket[];
    setTickets(rows);
    setOffset(nextOffset);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }

  function handleFilterSubmit(event: FormEvent) {
    event.preventDefault();
    void loadTickets(0);
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
        <div className="mb-8">
          <p className="text-sm font-medium text-zinc-500">Yönetim</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Destek Talepleri
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Kullanıcıların oluşturduğu destek taleplerini yönetin.
          </p>
        </div>

        <form
          onSubmit={handleFilterSubmit}
          className="mb-8 grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">
              Durum
            </span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              <option value="">Tümü</option>
              <option value="open">Açık</option>
              <option value="in_progress">İnceleniyor</option>
              <option value="resolved">Çözüldü</option>
              <option value="closed">Kapatıldı</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">
              Öncelik
            </span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              <option value="">Tümü</option>
              <option value="low">Düşük</option>
              <option value="normal">Normal</option>
              <option value="high">Yüksek</option>
              <option value="urgent">Acil</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">
              Kategori
            </span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              <option value="">Tümü</option>
              <option value="job">İş</option>
              <option value="offer">Teklif</option>
              <option value="messaging">Mesajlaşma</option>
              <option value="account">Hesap</option>
              <option value="payment">Ödeme</option>
              <option value="technical">Teknik</option>
              <option value="other">Diğer</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Filtrele
            </button>
          </div>
        </form>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500">Talepler yükleniyor...</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-zinc-500">Kayıt bulunamadı.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/admin/support/${ticket.id}`}
                className={`block rounded-2xl border p-5 transition hover:border-zinc-300 ${
                  ticket.is_unread
                    ? "border-zinc-300 bg-zinc-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-zinc-400">#{ticket.id}</p>
                      {ticket.is_unread ? (
                        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-white">
                          Okunmadı
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-1 text-base font-semibold text-zinc-900">
                      {ticket.subject}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      {ticket.user_name || "İsimsiz kullanıcı"}
                      {" · "}
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
                <p className="mt-3 text-xs text-zinc-400">
                  {formatDateTime(ticket.created_at)}
                  {ticket.job_title ? ` · ${ticket.job_title}` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            disabled={loading || offset === 0}
            onClick={() => void loadTickets(Math.max(offset - PAGE_SIZE, 0))}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Önceki
          </button>
          <p className="text-xs text-zinc-400">
            {offset + 1}–{offset + tickets.length}
          </p>
          <button
            type="button"
            disabled={loading || !hasMore}
            onClick={() => void loadTickets(offset + PAGE_SIZE)}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sonraki
          </button>
        </div>
      </section>
    </main>
  );
}
