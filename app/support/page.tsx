"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

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

type AccessibleJob = {
  id: number;
  public_id: string | null;
  title: string;
};

const CATEGORY_OPTIONS: Array<{ value: TicketCategory; label: string }> = [
  { value: "job", label: "İşimle ilgili sorun" },
  { value: "offer", label: "Teklifle ilgili sorun" },
  { value: "messaging", label: "Mesajlaşma sorunu" },
  { value: "account", label: "Hesap / profil" },
  { value: "payment", label: "Ödeme / ücret" },
  { value: "technical", label: "Teknik sorun" },
  { value: "other", label: "Diğer" },
];

const PRIORITY_OPTIONS: Array<{ value: TicketPriority; label: string }> = [
  { value: "low", label: "Düşük" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Yüksek" },
  { value: "urgent", label: "Acil" },
];

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
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

export default function SupportPage() {
  const supabase = createClient();
  const router = useRouter();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [jobs, setJobs] = useState<AccessibleJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [category, setCategory] = useState<TicketCategory | "">("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [relatedJobId, setRelatedJobId] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const [ticketsResult, jobsResult] = await Promise.all([
      supabase
        .from("admin_support_tickets")
        .select(
          "id, created_at, subject, description, category, priority, status, related_job_id",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("jobs")
        .select("id, public_id, title")
        .order("created_at", { ascending: false }),
    ]);

    if (ticketsResult.error) {
      setError(
        ticketsResult.error.message ||
          "Destek talepleri yüklenirken bir hata oluştu.",
      );
      setTickets([]);
    } else {
      setTickets((ticketsResult.data ?? []) as SupportTicket[]);
    }

    if (jobsResult.error) {
      console.error(jobsResult.error);
      setJobs([]);
    } else {
      setJobs((jobsResult.data ?? []) as AccessibleJob[]);
    }

    setLoading(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!category) {
      setError("Kategori seçmelisin.");
      return;
    }

    if (!subject.trim()) {
      setError("Konu boş olamaz.");
      return;
    }

    if (!description.trim()) {
      setError("Açıklama boş olamaz.");
      return;
    }

    setSubmitting(true);

    const { error: createError } = await supabase.rpc(
      "create_support_ticket",
      {
        p_subject: subject.trim(),
        p_description: description.trim(),
        p_category: category,
        p_priority: priority,
        p_related_job_id: relatedJobId ? Number(relatedJobId) : null,
      },
    );

    if (createError) {
      setError(
        createError.message ||
          "Destek talebi oluşturulurken bir hata oluştu.",
      );
      setSubmitting(false);
      return;
    }

    setCategory("");
    setSubject("");
    setDescription("");
    setRelatedJobId("");
    setPriority("normal");
    setSuccess("Destek talebin oluşturuldu.");
    setSubmitting(false);
    await loadPage();
  }

  function jobTitle(jobId: number | null) {
    if (jobId == null) {
      return null;
    }

    return jobs.find((job) => job.id === jobId)?.title ?? `İş #${jobId}`;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-zinc-500">Destek sayfası yükleniyor...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl pb-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Destek & Yardım
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Yaşadığınız sorunları bize iletin. Destek taleplerinizi buradan
            takip edebilirsiniz.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">
            Yeni destek talebi
          </h2>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div>
              <label htmlFor="category" className="text-sm font-medium">
                Kategori
              </label>
              <select
                id="category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as TicketCategory | "")
                }
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-500"
              >
                <option value="">Kategori seç</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="subject" className="text-sm font-medium">
                Konu
              </label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Sorununuzu kısaca özetleyin"
                className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2.5 outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label htmlFor="description" className="text-sm font-medium">
                Açıklama
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                placeholder="Sorunu mümkün olduğunca detaylı açıklayın."
                className="mt-2 w-full resize-none rounded-lg border border-zinc-300 px-3 py-2.5 outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label htmlFor="relatedJob" className="text-sm font-medium">
                İlgili iş
              </label>
              <select
                id="relatedJob"
                value={relatedJobId}
                onChange={(event) => setRelatedJobId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-500"
              >
                <option value="">İş seçmek istemiyorum</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="priority" className="text-sm font-medium">
                Öncelik
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as TicketPriority)
                }
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-500"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Gönderiliyor..." : "Destek talebi oluştur"}
            </button>
          </form>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-zinc-900">Taleplerim</h2>

          {tickets.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
              <h3 className="text-lg font-medium text-zinc-900">
                Henüz destek talebin yok.
              </h3>
              <p className="mt-2 text-sm text-zinc-500">
                Bir sorun yaşarsan yukarıdaki formdan bize yazabilirsin.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {tickets.map((ticket) => {
                const relatedTitle = jobTitle(ticket.related_job_id);

                return (
                  <Link
                    key={ticket.id}
                    href={`/support/${ticket.id}`}
                    className="block rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-zinc-900">
                          {ticket.subject}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500">
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
                      {formatDate(ticket.created_at)}
                      {relatedTitle ? ` · ${relatedTitle}` : ""}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
