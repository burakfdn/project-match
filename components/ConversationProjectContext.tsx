"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { getJobPublicIdMap } from "@/lib/jobs/public-id";

export type ConversationJob = {
  job_id: number;
  public_id: string | null;
  title: string;
  status: string;
  linked_at: string;
  budget: number | null;
  location_type: string | null;
  customer_id: string | null;
  offer_status: string | null;
  offer_price: number | null;
};

const JOB_STATUS_PRIORITY: Record<string, number> = {
  in_progress: 0,
  open: 1,
  completed: 2,
  closed: 3,
  cancelled: 4,
};

function formatJobStatus(status: string) {
  switch (status) {
    case "open":
      return "Teklif alıyor";
    case "in_progress":
      return "Devam ediyor";
    case "completed":
      return "Tamamlandı";
    case "closed":
      return "Kapalı";
    case "cancelled":
      return "İptal edildi";
    default:
      return status;
  }
}

function formatJobBudget(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Belirtilmedi";
  }

  return `${value.toLocaleString("tr-TR")} TL`;
}

function formatLocationType(value: string | null) {
  switch (value) {
    case "remote":
      return "Uzaktan";
    case "on_site":
      return "Yerinde";
    case "hybrid":
      return "Hibrit";
    default:
      return "Belirtilmedi";
  }
}

function formatOfferPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return `${value.toLocaleString("tr-TR")} TL`;
}

function jobStatusRank(status: string) {
  return JOB_STATUS_PRIORITY[status] ?? 99;
}

export function conversationJobHref(
  jobs: ConversationJob[],
  jobId: number,
) {
  const match = jobs.find((job) => job.job_id === jobId);
  return `/jobs/${match?.public_id || jobId}`;
}

function prioritizeConversationJobs(jobs: ConversationJob[]) {
  return jobs
    .map((job, index) => ({ job, index }))
    .sort((a, b) => {
      const rankDiff = jobStatusRank(a.job.status) - jobStatusRank(b.job.status);

      if (rankDiff !== 0) {
        return rankDiff;
      }

      return a.index - b.index;
    })
    .map((item) => item.job);
}

function splitConversationJobs(jobs: ConversationJob[]) {
  const ordered = prioritizeConversationJobs(jobs);
  const primary = ordered[0] ?? null;
  const others = primary
    ? ordered.filter((job) => job.job_id !== primary.job_id)
    : [];

  return { primary, others };
}

function getOfferContextCopy(
  job: ConversationJob,
  currentUserId: string,
): { label: string; price: string | null } | null {
  if (!job.customer_id) {
    return null;
  }

  const isCustomer = job.customer_id === currentUserId;
  const priceLabel = formatOfferPrice(job.offer_price);

  if (isCustomer) {
    if (job.offer_status === "pending") {
      return {
        label: "Teklif gönderildi",
        price: priceLabel,
      };
    }

    if (job.offer_status === "accepted") {
      return {
        label: "Teklif kabul edildi",
        price: priceLabel,
      };
    }

    if (job.offer_status === "rejected") {
      return {
        label: "Teklif reddedildi",
        price: priceLabel,
      };
    }

    return {
      label: "Henüz teklif gönderilmedi",
      price: null,
    };
  }

  if (job.offer_status === "pending") {
    return {
      label: "Teklifiniz bekleniyor",
      price: priceLabel,
    };
  }

  if (job.offer_status === "accepted") {
    return {
      label: "Teklifiniz kabul edildi",
      price: priceLabel,
    };
  }

  if (job.offer_status === "rejected") {
    return {
      label: "Teklifiniz reddedildi",
      price: priceLabel,
    };
  }

  return {
    label: "Henüz teklif göndermediniz",
    price: null,
  };
}

function normalizeConversationJobs(data: unknown): ConversationJob[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const jobs = data.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }

    const job = row as Record<string, unknown>;
    const jobId = Number(job.job_id);

    if (!Number.isFinite(jobId) || jobId <= 0) {
      return [];
    }

    return [
      {
        job_id: jobId,
        public_id: null,
        title: job.title == null ? "" : String(job.title),
        status: job.status == null ? "" : String(job.status),
        linked_at: job.linked_at == null ? "" : String(job.linked_at),
        budget: null,
        location_type: null,
        customer_id: null,
        offer_status: null,
        offer_price: null,
      },
    ];
  });

  return prioritizeConversationJobs(jobs);
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function mergeConversationJobDetails(
  jobs: ConversationJob[],
  jobRows: unknown,
  offerRows: unknown,
  currentUserId: string | null,
  otherUserId: string | null,
): ConversationJob[] {
  const jobById = new Map<number, Record<string, unknown>>();

  if (Array.isArray(jobRows)) {
    for (const row of jobRows) {
      if (!row || typeof row !== "object") {
        continue;
      }

      const job = row as Record<string, unknown>;
      const jobId = Number(job.id);

      if (Number.isFinite(jobId) && jobId > 0) {
        jobById.set(jobId, job);
      }
    }
  }

  const offersByJobId = new Map<number, Record<string, unknown>[]>();

  if (Array.isArray(offerRows)) {
    for (const row of offerRows) {
      if (!row || typeof row !== "object") {
        continue;
      }

      const offer = row as Record<string, unknown>;
      const jobId = Number(offer.job_id);

      if (!Number.isFinite(jobId) || jobId <= 0) {
        continue;
      }

      const existing = offersByJobId.get(jobId) ?? [];
      existing.push(offer);
      offersByJobId.set(jobId, existing);
    }
  }

  return jobs.map((job) => {
    const details = jobById.get(job.job_id);
    const customerId =
      details?.customer_id == null
        ? job.customer_id
        : String(details.customer_id);
    const isCustomer =
      currentUserId != null && customerId === currentUserId;
    const offers = offersByJobId.get(job.job_id) ?? [];
    const counterpartId = isCustomer ? otherUserId : currentUserId;
    const matchedOffer =
      counterpartId == null
        ? null
        : (offers.find(
            (offer) => String(offer.provider_id ?? "") === counterpartId,
          ) ?? null);

    return {
      ...job,
      public_id: job.public_id,
      title: details?.title == null ? job.title : String(details.title),
      status:
        details?.status == null ? job.status : String(details.status),
      budget: parseOptionalNumber(details?.budget),
      location_type:
        details?.location_type == null
          ? null
          : String(details.location_type),
      customer_id: customerId,
      offer_status:
        matchedOffer?.status == null
          ? null
          : String(matchedOffer.status),
      offer_price: parseOptionalNumber(matchedOffer?.price),
    };
  });
}

export async function loadConversationProjectJobs(
  supabase: ReturnType<typeof createClient>,
  conversationId: number,
  currentUserId: string | null,
  otherUserId: string | null,
): Promise<ConversationJob[]> {
  const { data, error } = await supabase.rpc("get_conversation_jobs", {
    p_conversation_id: conversationId,
  });

  if (error) {
    return [];
  }

  const jobs = normalizeConversationJobs(data);

  if (jobs.length === 0) {
    return [];
  }

  const jobIds = jobs.map((job) => job.job_id);
  const [{ data: jobRows }, { data: offerRows }, publicIds] =
    await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, budget, location_type, status, customer_id")
      .in("id", jobIds),
    supabase
      .from("offers")
      .select("job_id, provider_id, status, price")
      .in("job_id", jobIds),
    getJobPublicIdMap(supabase, jobIds),
  ]);

  return prioritizeConversationJobs(
    mergeConversationJobDetails(
      jobs.map((job) => ({
        ...job,
        public_id: publicIds.get(job.job_id) ?? null,
      })),
      jobRows,
      offerRows,
      currentUserId,
      otherUserId,
    ),
  );
}

function ProjectContextCard({
  job,
  currentUserId,
  onViewJob,
}: {
  job: ConversationJob;
  currentUserId: string;
  onViewJob: (jobId: number) => void;
}) {
  const offerCopy = getOfferContextCopy(job, currentUserId);

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
      <p className="truncate text-sm font-semibold text-zinc-900">
        {job.title.trim() || "Proje"}
      </p>
      <dl className="mt-2 space-y-1 text-xs leading-4 text-zinc-600">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-zinc-400">Bütçe</dt>
          <dd className="truncate text-right font-medium text-zinc-800">
            {formatJobBudget(job.budget)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-zinc-400">Çalışma şekli</dt>
          <dd className="truncate text-right font-medium text-zinc-800">
            {formatLocationType(job.location_type)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-zinc-400">Durum</dt>
          <dd className="truncate text-right font-medium text-zinc-800">
            {formatJobStatus(job.status)}
          </dd>
        </div>
        {offerCopy ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="shrink-0 text-zinc-400">Teklif</dt>
              <dd className="truncate text-right font-medium text-zinc-800">
                {offerCopy.label}
              </dd>
            </div>
            {offerCopy.price ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-zinc-400">Teklif fiyatı</dt>
                <dd className="truncate text-right font-medium text-zinc-800">
                  {offerCopy.price}
                </dd>
              </div>
            ) : null}
          </>
        ) : null}
      </dl>
      <button
        type="button"
        onClick={() => onViewJob(job.job_id)}
        className="mt-2.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
      >
        Projeyi Gör
      </button>
    </div>
  );
}

function formatCompactAmount(value: number) {
  return `₺${value.toLocaleString("tr-TR")}`;
}

function formatCompactProjectSummary(job: ConversationJob) {
  const parts = [job.title.trim() || "Proje"];

  if (job.budget !== null && Number.isFinite(job.budget)) {
    parts.push(formatCompactAmount(job.budget));
  }

  if (job.status) {
    parts.push(formatJobStatus(job.status));
  }

  if (job.offer_price !== null && Number.isFinite(job.offer_price)) {
    parts.push(`Teklif: ${formatCompactAmount(job.offer_price)}`);
  }

  return parts.join(" · ");
}

export function getConversationJobStartIndex(
  messages: { created_at: string }[],
  linkedAt: string,
) {
  const linkedMs = Date.parse(linkedAt);

  if (!Number.isFinite(linkedMs)) {
    return messages.length;
  }

  const index = messages.findIndex((item) => {
    const createdMs = Date.parse(item.created_at);
    return Number.isFinite(createdMs) && createdMs >= linkedMs;
  });

  return index === -1 ? messages.length : index;
}

export function ConversationStartNotice({
  job,
  onViewJob,
}: {
  job: ConversationJob;
  onViewJob: (jobId: number) => void;
}) {
  const budgetLabel =
    job.budget !== null && Number.isFinite(job.budget)
      ? formatCompactAmount(job.budget)
      : null;

  return (
    <div className="py-1">
      <div className="border-t border-zinc-200" />
      <div className="px-1 py-2.5 text-center">
        <p className="text-xs leading-4 text-zinc-500">
          Bu proje için mesajlaşma başlatıldı
        </p>
        <p className="mt-1 truncate text-xs font-medium text-zinc-800">
          {job.title.trim() || "Proje"}
          {budgetLabel ? ` · ${budgetLabel}` : ""}
        </p>
        <button
          type="button"
          onClick={() => onViewJob(job.job_id)}
          className="mt-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
        >
          Projeyi Gör
        </button>
      </div>
      <div className="border-t border-zinc-200" />
    </div>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`h-4 w-4 ${up ? "rotate-180" : ""}`}
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ConversationProjectContext({
  jobs,
  currentUserId,
  onViewJob,
}: {
  jobs: ConversationJob[];
  currentUserId: string;
  onViewJob: (jobId: number) => void;
  compact?: boolean;
}) {
  const { primary, others } = splitConversationJobs(jobs);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);

  useEffect(() => {
    setDetailsOpen(false);
    setOthersOpen(false);
  }, [primary?.job_id]);

  if (!primary) {
    return null;
  }

  return (
    <div className="relative z-10 shrink-0 border-b border-zinc-100">
      <button
        type="button"
        onClick={() =>
          setDetailsOpen((current) => {
            if (current) {
              setOthersOpen(false);
            }

            return !current;
          })
        }
        className="flex w-full items-center gap-1 py-0.5 pr-1 pl-4 text-left"
        aria-expanded={detailsOpen}
        aria-label={
          detailsOpen
            ? "Proje detaylarını kapat"
            : "Proje detaylarını aç"
        }
      >
        <span className="min-w-0 flex-1 truncate text-xs leading-4 text-zinc-600">
          {formatCompactProjectSummary(primary)}
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500">
          <ChevronIcon up={detailsOpen} />
        </span>
      </button>

      {detailsOpen ? (
        <div className="absolute inset-x-0 top-full z-20 border-b border-zinc-100 bg-white px-4 py-3 shadow-sm">
          <div className="max-h-64 space-y-2 overflow-y-auto">
            <ProjectContextCard
              job={primary}
              currentUserId={currentUserId}
              onViewJob={onViewJob}
            />
            {others.length > 0 ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setOthersOpen((current) => !current)}
                  className="text-left text-xs font-medium text-zinc-500 hover:text-zinc-800"
                  aria-expanded={othersOpen}
                >
                  Diğer projeler ({others.length})
                </button>
                {othersOpen
                  ? others.map((job) => (
                      <ProjectContextCard
                        key={job.job_id}
                        job={job}
                        currentUserId={currentUserId}
                        onViewJob={onViewJob}
                      />
                    ))
                  : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
