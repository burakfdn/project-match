"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

export const RECENT_PROVIDERS_STORAGE_KEY = "project-match-recent-providers";
const MAX_STORED = 6;
const MAX_VISIBLE = 4;

export type RecentProviderRecord = {
  id: string;
  fullName: string;
  bio: string | null;
  city: string | null;
  workLabel: string | null;
  imageUrl: string | null;
  viewedAt: number;
};

function storageKey(userId: string) {
  return `${RECENT_PROVIDERS_STORAGE_KEY}:${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(value: unknown): RecentProviderRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";

  if (!id) {
    return null;
  }

  const fullName =
    typeof value.fullName === "string" && value.fullName.trim()
      ? value.fullName.trim()
      : "İsimsiz Uzman";
  const viewedAt = Number(value.viewedAt);

  return {
    id,
    fullName,
    bio:
      typeof value.bio === "string" && value.bio.trim()
        ? value.bio.trim()
        : null,
    city:
      typeof value.city === "string" && value.city.trim()
        ? value.city.trim()
        : null,
    workLabel:
      typeof value.workLabel === "string" && value.workLabel.trim()
        ? value.workLabel.trim()
        : null,
    imageUrl:
      typeof value.imageUrl === "string" && value.imageUrl.trim()
        ? value.imageUrl.trim()
        : null,
    viewedAt: Number.isFinite(viewedAt) ? viewedAt : 0,
  };
}

function readRecentProviders(userId: string): RecentProviderRecord[] {
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

    const seen = new Set<string>();
    const records: RecentProviderRecord[] = [];

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

function writeRecentProviders(userId: string, records: RecentProviderRecord[]) {
  window.localStorage.setItem(
    storageKey(userId),
    JSON.stringify(records.slice(0, MAX_STORED)),
  );
}

export function rememberRecentProvider(
  record: Omit<RecentProviderRecord, "viewedAt">,
  userId: string | null,
) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  const id = record.id.trim();

  if (!id) {
    return;
  }

  try {
    const next: RecentProviderRecord = {
      id,
      fullName: record.fullName.trim() || "İsimsiz Uzman",
      bio: record.bio,
      city: record.city,
      workLabel: record.workLabel,
      imageUrl: record.imageUrl,
      viewedAt: Date.now(),
    };

    const existing = readRecentProviders(userId).filter(
      (item) => item.id !== id,
    );

    writeRecentProviders(userId, [next, ...existing]);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

export function RecentProviders() {
  const [providers, setProviders] = useState<RecentProviderRecord[]>([]);

  useEffect(() => {
    async function loadRecent() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProviders([]);
        return;
      }

      setProviders(readRecentProviders(user.id).slice(0, MAX_VISIBLE));
    }

    void loadRecent();
  }, []);

  if (providers.length === 0) {
    return null;
  }

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
        Son Baktığın Uzmanlar
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        Daha önce incelediğin uzmanlara hızlıca geri dön.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {providers.map((provider) => {
          const bio = excerpt(provider.bio);

          return (
            <article
              key={provider.id}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white"
            >
              <div className="relative aspect-[4/3] bg-zinc-100">
                {provider.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={provider.imageUrl}
                    alt={provider.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-end p-3">
                    <p className="text-[11px] font-medium leading-4 text-zinc-500">
                      Portfolyo
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">
                    {getInitials(provider.fullName)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-zinc-950">
                      {provider.fullName}
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {[provider.city, provider.workLabel]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                {bio ? (
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{bio}</p>
                ) : (
                  <p className="mt-3 text-sm text-zinc-400">
                    Henüz bio eklenmemiş.
                  </p>
                )}

                <div className="mt-auto pt-5">
                  <Link
                    href={`/providers/${provider.id}`}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                  >
                    Profili Gör →
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
