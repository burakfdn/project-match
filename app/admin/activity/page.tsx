"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { resolveJobRoute } from "@/lib/jobs/public-id";
import { getPreviewUser } from "@/lib/preview";

type ActivityEvent = {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_role: string | null;
  actor_name: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_uuid: string | null;
  job_id: number | null;
  job_title: string | null;
  job_public_id: string | null;
  metadata: Record<string, unknown> | null;
};

const PAGE_SIZE = 50;

const EVENT_TYPES = [
  "job.created",
  "job.updated",
  "job.cancelled",
  "job.completed",
  "offer.created",
  "offer.accepted",
  "offer.rejected",
  "review.submitted",
  "review.skipped",
  "review.published",
  "profile.account_type_changed",
  "profile.name_updated",
  "message.sent",
  "admin.permissions_updated",
];

const EVENT_LABELS: Record<string, string> = {
  "job.created": "İş oluşturuldu",
  "job.updated": "İş güncellendi",
  "job.cancelled": "İş iptal edildi",
  "job.completed": "İş tamamlandı",
  "offer.created": "Teklif oluşturuldu",
  "offer.accepted": "Teklif kabul edildi",
  "offer.rejected": "Teklif reddedildi",
  "review.submitted": "Değerlendirme gönderildi",
  "review.skipped": "Değerlendirme atlandı",
  "review.published": "Değerlendirme yayınlandı",
  "profile.account_type_changed": "Hesap tipi değişti",
  "profile.name_updated": "İsim güncellendi",
  "message.sent": "Mesaj gönderildi",
  "admin.permissions_updated": "Yetkiler güncellendi",
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

function formatActorRole(value: string | null) {
  switch (value) {
    case "customer":
      return "Proje sahibi";
    case "provider":
      return "Uzman";
    case "admin":
      return "Admin";
    case "system":
      return "Sistem";
    default:
      return "—";
  }
}

function formatMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "—";
  }

  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

export default function AdminActivityPage() {
  const supabase = createClient();
  const router = useRouter();

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [eventType, setEventType] = useState("");
  const [actorId, setActorId] = useState("");
  const [jobRef, setJobRef] = useState("");

  useEffect(() => {
    checkAccessAndLoad();
  }, []);

  const visibleTypes = EVENT_TYPES;

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

    await loadEvents(0);
  }

  async function resolveJobFilter(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }

    const resolved = await resolveJobRoute(supabase, trimmed);

    return resolved?.id ?? Number.NaN;
  }

  async function loadEvents(nextOffset: number) {
    setLoading(true);
    setError("");

    const trimmedActor = actorId.trim();
    let actorFilter: string | null = null;

    if (trimmedActor) {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          trimmedActor,
        );

      if (!isUuid) {
        setError("Actor filtresi geçerli bir kullanıcı UUID’si olmalı.");
        setLoading(false);
        return;
      }

      actorFilter = trimmedActor;
    }

    const jobId = await resolveJobFilter(jobRef);

    if (Number.isNaN(jobId)) {
      setError("Job filtresi geçerli bir iş numarası veya public ID olmalı.");
      setLoading(false);
      return;
    }

    const { data, error: listError } = await supabase.rpc(
      "admin_list_activity_events",
      {
        p_limit: PAGE_SIZE,
        p_offset: nextOffset,
        p_event_type: eventType || null,
        p_actor_id: actorFilter,
        p_job_id: jobId,
      },
    );

    if (listError) {
      console.error("Admin activity error:", listError);
      setError(
        listError.message ||
          "Aktiviteler yüklenirken bir hata oluştu.",
      );
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as ActivityEvent[];
    setEvents(rows);
    setOffset(nextOffset);
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }

  function handleFilterSubmit(event: FormEvent) {
    event.preventDefault();
    void loadEvents(0);
  }

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
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
              className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              Destek Talepleri
            </Link>
            <Link
              href="/admin/activity"
              className="text-sm font-medium text-zinc-950"
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
          <p className="text-sm font-medium text-zinc-500">
            Yönetim
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Aktivite Arşivi
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Sistemdeki önemli kullanıcı ve admin aksiyonlarını kronolojik
            olarak incele.
          </p>
        </div>

        <form
          onSubmit={handleFilterSubmit}
          className="mb-8 grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">
              Olay tipi
            </span>
            <select
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              <option value="">Tümü</option>
              {visibleTypes.map((type) => (
                <option key={type} value={type}>
                  {EVENT_LABELS[type] ?? type}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">
              Actor ID
            </span>
            <input
              value={actorId}
              onChange={(event) => setActorId(event.target.value)}
              placeholder="uuid"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-500">
              Job ID
            </span>
            <input
              value={jobRef}
              onChange={(event) => setJobRef(event.target.value)}
              placeholder="52 veya public uuid"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            />
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
          <p className="text-sm text-zinc-500">Aktiviteler yükleniyor...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-zinc-500">Kayıt bulunamadı.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const jobHref = event.job_public_id || event.job_id;

              return (
                <article
                  key={event.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs text-zinc-400">
                        {formatDateTime(event.occurred_at)}
                      </p>
                      <h2 className="mt-1 text-base font-semibold text-zinc-900">
                        {EVENT_LABELS[event.event_type] ?? event.event_type}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        {event.actor_name || "Bilinmeyen kullanıcı"}
                        {" · "}
                        {formatActorRole(event.actor_role)}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-zinc-400">
                      {event.event_type}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
                    {jobHref ? (
                      <Link
                        href={`/jobs/${jobHref}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {event.job_title || `İş #${event.job_id}`}
                      </Link>
                    ) : null}
                    {event.entity_type ? (
                      <span>
                        {event.entity_type}
                        {event.entity_id != null
                          ? ` #${event.entity_id}`
                          : event.entity_uuid
                            ? ` ${event.entity_uuid.slice(0, 8)}`
                            : ""}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    {formatMetadata(event.metadata)}
                  </p>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            disabled={loading || offset === 0}
            onClick={() => void loadEvents(Math.max(offset - PAGE_SIZE, 0))}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Önceki
          </button>
          <p className="text-xs text-zinc-400">
            {offset + 1}–{offset + events.length}
          </p>
          <button
            type="button"
            disabled={loading || !hasMore}
            onClick={() => void loadEvents(offset + PAGE_SIZE)}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sonraki
          </button>
        </div>
      </section>
    </main>
  );
}
