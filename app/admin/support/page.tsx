"use client";

import { useEffect, useMemo, useState } from "react";
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
  assigned_admin_id?: string | null;
};

type SupportAdmin = {
  id: string;
  full_name: string | null;
};

const PAGE_SIZE = 100;

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
  in_progress: "İşlemde",
  resolved: "Çözüldü",
  closed: "Kapalı",
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

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
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

function priorityClass(priority: TicketPriority) {
  switch (priority) {
    case "low":
      return "bg-zinc-100 text-zinc-500";
    case "normal":
      return "bg-zinc-100 text-zinc-600";
    case "high":
      return "bg-amber-50 text-amber-800";
    case "urgent":
      return "bg-red-50 text-red-700";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
}

export default function AdminSupportPage() {
  const supabase = createClient();
  const router = useRouter();

  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [admins, setAdmins] = useState<SupportAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assigned, setAssigned] = useState("");
  const [unread, setUnread] = useState("");

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

    await loadTickets();
  }

  async function loadTickets() {
    setLoading(true);
    setError("");

    const rows: AdminSupportTicket[] = [];
    let nextOffset = 0;

    while (true) {
      const { data, error: listError } = await supabase.rpc(
        "admin_list_support_tickets",
        {
          p_limit: PAGE_SIZE,
          p_offset: nextOffset,
          p_status: null,
          p_priority: null,
          p_category: null,
        },
      );

      if (listError) {
        console.error("Admin support list error:", listError);
        setError(
          listError.message ||
            "Destek talepleri yüklenirken bir hata oluştu.",
        );
        setTickets([]);
        setLoading(false);
        return;
      }

      const batch = (data ?? []) as AdminSupportTicket[];
      rows.push(...batch);

      if (batch.length < PAGE_SIZE) {
        break;
      }

      nextOffset += PAGE_SIZE;
    }

    const [{ data: adminData }, { data: assignmentData }] = await Promise.all([
      supabase.rpc("admin_list_support_admins"),
      supabase.from("admin_support_tickets").select("id, assigned_admin_id"),
    ]);

    setAdmins((adminData ?? []) as SupportAdmin[]);

    const assignedById = new Map<number, string | null>();

    for (const row of assignmentData ?? []) {
      assignedById.set(Number(row.id), row.assigned_admin_id ?? null);
    }

    setTickets(
      rows.map((ticket) => ({
        ...ticket,
        assigned_admin_id: assignedById.has(ticket.id)
          ? assignedById.get(ticket.id)
          : ticket.assigned_admin_id ?? null,
      })),
    );
    setLoading(false);
  }

  const hasActiveFilters =
    Boolean(search.trim()) ||
    Boolean(status) ||
    Boolean(priority) ||
    Boolean(assigned) ||
    Boolean(unread);

  const filteredTickets = useMemo(() => {
    const query = normalizeSearch(search);

    return tickets.filter((ticket) => {
      if (status && ticket.status !== status) {
        return false;
      }

      if (priority && ticket.priority !== priority) {
        return false;
      }

      if (assigned === "unassigned") {
        if (ticket.assigned_admin_id) {
          return false;
        }
      } else if (assigned && ticket.assigned_admin_id !== assigned) {
        return false;
      }

      if (unread === "unread" && !ticket.is_unread) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        ticket.subject,
        ticket.user_name,
        ticket.job_title,
      ]
        .filter(Boolean)
        .map((value) => normalizeSearch(String(value)))
        .join(" ");

      return haystack.includes(query);
    });
  }, [assigned, priority, search, status, tickets, unread]);

  function clearFilters() {
    setSearch("");
    setStatus("");
    setPriority("");
    setAssigned("");
    setUnread("");
  }

  const selectClassName =
    "min-w-[8.5rem] flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 sm:flex-none";

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

        <div className="mb-6">
          <label className="block">
            <span className="sr-only">Ara</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Konu, kullanıcı veya iş ara"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <select
              aria-label="Durum"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={selectClassName}
            >
              <option value="">Durum: Tümü</option>
              <option value="open">Açık</option>
              <option value="in_progress">İşlemde</option>
              <option value="resolved">Çözüldü</option>
              <option value="closed">Kapalı</option>
            </select>

            <select
              aria-label="Öncelik"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className={selectClassName}
            >
              <option value="">Öncelik: Tümü</option>
              <option value="low">Düşük</option>
              <option value="normal">Normal</option>
              <option value="high">Yüksek</option>
              <option value="urgent">Acil</option>
            </select>

            <select
              aria-label="Atanan"
              value={assigned}
              onChange={(event) => setAssigned(event.target.value)}
              className={selectClassName}
            >
              <option value="">Atanan: Tümü</option>
              <option value="unassigned">Atanmamış</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.full_name || "İsimsiz admin"}
                </option>
              ))}
            </select>

            <select
              aria-label="Okunma"
              value={unread}
              onChange={(event) => setUnread(event.target.value)}
              className={selectClassName}
            >
              <option value="">Okunma: Tümü</option>
              <option value="unread">Okunmamış</option>
            </select>
          </div>

          <p className="mt-3 text-xs text-zinc-400">
            {loading
              ? "Talepler yükleniyor..."
              : `${filteredTickets.length} ticket gösteriliyor`}
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500">Talepler yükleniyor...</p>
        ) : filteredTickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-center">
            <p className="text-sm text-zinc-600">
              {hasActiveFilters
                ? "Filtrelere uyan destek talebi bulunamadı."
                : "Kayıt bulunamadı."}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 text-sm font-medium text-zinc-700 hover:text-zinc-950"
              >
                Filtreleri temizle
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTickets.map((ticket) => (
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
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${priorityClass(
                        ticket.priority,
                      )}`}
                    >
                      {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                    </span>
                    <span
                      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                        ticket.status,
                      )}`}
                    >
                      {STATUS_LABELS[ticket.status] ?? ticket.status}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-400">
                  {formatDateTime(ticket.created_at)}
                  {ticket.job_title ? ` · ${ticket.job_title}` : ""}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
