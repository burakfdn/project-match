"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { jobHref } from "@/lib/jobs/public-id";

export const RECENT_JOBS_STORAGE_KEY = "project-match-recent-jobs";
const MAX_STORED = 6;
const MAX_VISIBLE = 4;

export type RecentJobRecord = {
  id: number;
  publicId: string | null;
  title: string;
  description: string | null;
  categoryName: string | null;
  serviceName: string | null;
  budget: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  locationType: string | null;
  city: string | null;
  viewedAt: number;
};

function storageKey(userId: string) {
  return `${RECENT_JOBS_STORAGE_KEY}:${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function parseRecord(value: unknown): RecentJobRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = parseOptionalNumber(value.id);

  if (id === null || id <= 0) {
    return null;
  }

  const title =
    typeof value.title === "string" && value.title.trim()
      ? value.title.trim()
      : "Başlıksız iş";
  const viewedAt = Number(value.viewedAt);

  return {
    id,
    publicId: parseOptionalText(value.publicId),
    title,
    description: parseOptionalText(value.description),
    categoryName: parseOptionalText(value.categoryName),
    serviceName: parseOptionalText(value.serviceName),
    budget: parseOptionalNumber(value.budget),
    budgetMin: parseOptionalNumber(value.budgetMin),
    budgetMax: parseOptionalNumber(value.budgetMax),
    locationType: parseOptionalText(value.locationType),
    city: parseOptionalText(value.city),
    viewedAt: Number.isFinite(viewedAt) ? viewedAt : 0,
  };
}

function readRecentJobs(userId: string): RecentJobRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey(userId));

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    const seen = new Set<number>();
    const records: RecentJobRecord[] = [];

    for (const item of parsed) {
      const record = parseRecord(item);

      if (!record || seen.has(record.id)) {
        continue;
      }

      seen.add(record.id);
      records.push(record);
    }

    return records.slice(0, MAX_STORED);
  } catch {
    return [];
  }
}

function writeRecentJobs(userId: string, records: RecentJobRecord[]) {
  window.localStorage.setItem(
    storageKey(userId),
    JSON.stringify(records.slice(0, MAX_STORED)),
  );
}

export function rememberRecentJob(
  record: Omit<RecentJobRecord, "viewedAt">,
  userId: string | null,
) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  const id = Number(record.id);

  if (!Number.isFinite(id) || id <= 0) {
    return;
  }

  try {
    const next: RecentJobRecord = {
      id,
      publicId: record.publicId?.trim() || null,
      title: record.title.trim() || "Başlıksız iş",
      description: record.description,
      categoryName: record.categoryName,
      serviceName: record.serviceName,
      budget: record.budget,
      budgetMin: record.budgetMin,
      budgetMax: record.budgetMax,
      locationType: record.locationType,
      city: record.city,
      viewedAt: Date.now(),
    };

    const existing = readRecentJobs(userId).filter((item) => item.id !== id);

    writeRecentJobs(userId, [next, ...existing]);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function excerpt(value: string | null, maxLength = 110) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

function getLocationLabel(job: RecentJobRecord) {
  if (job.locationType === "remote") {
    return "Uzaktan";
  }

  const workLabel =
    job.locationType === "on_site"
      ? "Yerinde"
      : job.locationType === "hybrid"
        ? "Hibrit"
        : null;

  return [job.city, workLabel].filter(Boolean).join(" · ");
}

function formatBudget(job: RecentJobRecord) {
  if (
    job.budgetMin !== null &&
    job.budgetMax !== null &&
    job.budgetMin !== job.budgetMax
  ) {
    return `${job.budgetMin.toLocaleString("tr-TR")} – ${job.budgetMax.toLocaleString("tr-TR")} TL`;
  }

  const amount = job.budget ?? job.budgetMin ?? job.budgetMax;

  if (amount !== null) {
    return `${amount.toLocaleString("tr-TR")} TL`;
  }

  return "Belirtilmedi";
}

export function RecentJobs() {
  const [jobs, setJobs] = useState<RecentJobRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecent() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setJobs([]);
        setLoading(false);
        return;
      }

      setJobs(readRecentJobs(user.id).slice(0, MAX_VISIBLE));
      setLoading(false);
    }

    void loadRecent();
  }, []);

  if (loading) {
    return (
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
          Son Baktığın İşler
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Daha önce incelediğin işlere hızlıca geri dön.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`recent-job-skeleton-${index}`}
              className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5"
            >
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
              <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
              <div className="mt-4 h-3 w-full animate-pulse rounded bg-zinc-100" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
              <div className="mt-auto pt-5">
                <div className="h-9 w-full animate-pulse rounded-lg bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
        Son Baktığın İşler
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        Daha önce incelediğin işlere hızlıca geri dön.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {jobs.map((job) => {
          const description = excerpt(job.description);
          const categoryLine = [job.categoryName, job.serviceName]
            .filter(Boolean)
            .join(" · ");
          const locationLabel = getLocationLabel(job);

          return (
            <article
              key={job.id}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5"
            >
              <h3 className="text-base font-semibold text-zinc-950">
                {job.title}
              </h3>

              {categoryLine ? (
                <p className="mt-1.5 text-xs text-zinc-500">{categoryLine}</p>
              ) : null}

              <p className="mt-3 text-sm font-medium text-zinc-800">
                {formatBudget(job)}
              </p>

              {locationLabel ? (
                <p className="mt-1 text-xs text-zinc-500">{locationLabel}</p>
              ) : null}

              {description ? (
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {description}
                </p>
              ) : (
                <p className="mt-3 text-sm text-zinc-400">
                  Açıklama eklenmemiş.
                </p>
              )}

              <div className="mt-auto pt-5">
                <Link
                  href={jobHref({
                    id: job.id,
                    public_id: job.publicId,
                  })}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                >
                  İşi Gör
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
