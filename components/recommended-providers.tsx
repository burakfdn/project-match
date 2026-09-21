"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { getPreviewUser } from "@/lib/preview";

type PortfolioPreview = {
  id: number;
  title: string;
  imageUrl: string | null;
};

type ProviderCard = {
  id: string;
  fullName: string;
  bio: string | null;
  city: string | null;
  canWorkRemote: boolean;
  canWorkOnSite: boolean;
  services: {
    id: number;
    name: string;
    categoryId: number | null;
    categoryName: string;
  }[];
  portfolio: PortfolioPreview[];
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  city: string | null;
  can_work_remote: boolean | null;
  can_work_on_site: boolean | null;
  bio: string | null;
};

type ServiceRow = {
  provider_id: string;
  service_id: number;
  service_name: string;
  category_id?: number | null;
  category_name: string | null;
};

type WorkSampleRow = {
  id: number;
  provider_id: string;
  title: string | null;
  project_url: string | null;
};

function getWorkLabel(provider: ProviderCard) {
  if (provider.canWorkRemote && provider.canWorkOnSite) {
    return "Hibrit";
  }

  if (provider.canWorkRemote) {
    return "Uzaktan";
  }

  if (provider.canWorkOnSite) {
    return "Yerinde";
  }

  return "Belirtilmemiş";
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

function isImageUrl(url: string | null) {
  if (!url?.trim()) {
    return false;
  }

  try {
    const parsed = new URL(
      /^https?:\/\//i.test(url) ? url : `https://${url}`,
    );
    return /\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i.test(parsed.pathname);
  } catch {
    return false;
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

function profileScore(provider: ProviderCard) {
  return (
    (provider.bio ? 1 : 0) +
    (provider.city ? 1 : 0) +
    (provider.services.length > 0 ? 2 : 0) +
    (provider.portfolio.length > 0 ? 1 : 0)
  );
}

function matchScore(
  provider: ProviderCard,
  preferredServiceIds: Set<number>,
  preferredCategoryIds: Set<number>,
) {
  if (preferredServiceIds.size === 0 && preferredCategoryIds.size === 0) {
    return 0;
  }

  let score = 0;
  const matchedServices = new Set<number>();
  const matchedCategories = new Set<number>();

  for (const service of provider.services) {
    if (preferredServiceIds.has(service.id) && !matchedServices.has(service.id)) {
      matchedServices.add(service.id);
      score += 2;
    } else if (
      service.categoryId !== null &&
      preferredCategoryIds.has(service.categoryId) &&
      !matchedCategories.has(service.categoryId)
    ) {
      matchedCategories.add(service.categoryId);
      score += 1;
    }
  }

  return score;
}

export function RecommendedProviders() {
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadRecommended();
  }, []);

  async function loadRecommended() {
    const supabase = createClient();

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setProviders([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    const previewUser = getPreviewUser();
    const viewerId = previewUser?.id ?? user.id;

    const [profilesResult, servicesResult, jobsResult] = await Promise.all([
      supabase.rpc("discover_providers"),
      supabase.rpc("discover_provider_services"),
      supabase
        .from("jobs")
        .select(
          `
          service_id,
          service:services (
            id,
            category_id
          )
        `,
        )
        .eq("customer_id", viewerId)
        .eq("status", "open"),
    ]);

    if (profilesResult.error) {
      console.error("discover_providers error:", profilesResult.error);
      setProviders([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    if (servicesResult.error) {
      console.error(
        "discover_provider_services error:",
        servicesResult.error,
      );
      setProviders([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    const profileRows = (profilesResult.data ?? []) as ProfileRow[];
    const candidateIds = profileRows
      .map((row) => row.user_id)
      .filter((id) => id && id !== viewerId);

    const preferredServiceIds = new Set<number>();
    const preferredCategoryIds = new Set<number>();

    if (!jobsResult.error) {
      for (const job of jobsResult.data ?? []) {
        const nestedService = Array.isArray(job.service)
          ? job.service[0]
          : job.service;
        const serviceId = Number(job.service_id ?? nestedService?.id);
        const categoryId = Number(nestedService?.category_id);

        if (Number.isFinite(serviceId) && serviceId > 0) {
          preferredServiceIds.add(serviceId);
        }

        if (Number.isFinite(categoryId) && categoryId > 0) {
          preferredCategoryIds.add(categoryId);
        }
      }
    }

    const samplesByProvider: Record<string, PortfolioPreview[]> = {};

    if (candidateIds.length > 0) {
      const { data: sampleRows, error: samplesError } = await supabase
        .from("provider_work_samples")
        .select("id, provider_id, title, project_url, created_at")
        .in("provider_id", candidateIds)
        .order("created_at", { ascending: false });

      if (samplesError) {
        console.error("provider_work_samples error:", samplesError);
      } else {
        for (const sample of (sampleRows ?? []) as WorkSampleRow[]) {
          const providerId = sample.provider_id;

          if (!samplesByProvider[providerId]) {
            samplesByProvider[providerId] = [];
          }

          if (samplesByProvider[providerId].length >= 3) {
            continue;
          }

          samplesByProvider[providerId].push({
            id: sample.id,
            title: sample.title?.trim() || "Çalışma",
            imageUrl: isImageUrl(sample.project_url)
              ? sample.project_url
              : null,
          });
        }
      }
    }

    const serviceRows = (servicesResult.data ?? []) as ServiceRow[];
    const servicesByProvider: Record<string, ProviderCard["services"]> = {};

    for (const service of serviceRows) {
      if (!servicesByProvider[service.provider_id]) {
        servicesByProvider[service.provider_id] = [];
      }

      servicesByProvider[service.provider_id].push({
        id: service.service_id,
        name: service.service_name,
        categoryId:
          typeof service.category_id === "number" ? service.category_id : null,
        categoryName: service.category_name?.trim() || "Diğer",
      });
    }

    const ranked = profileRows
      .map((row) => {
        const id = row.user_id;

        if (!id || id === viewerId) {
          return null;
        }

        const card: ProviderCard = {
          id,
          fullName: row.full_name?.trim() || "İsimsiz Uzman",
          bio: row.bio?.trim() || null,
          city: row.city?.trim() || null,
          canWorkRemote: Boolean(row.can_work_remote),
          canWorkOnSite: Boolean(row.can_work_on_site),
          services: servicesByProvider[id] ?? [],
          portfolio: samplesByProvider[id] ?? [],
        };

        return card;
      })
      .filter((item): item is ProviderCard => item !== null)
      .sort((a, b) => {
        const matchDiff =
          matchScore(b, preferredServiceIds, preferredCategoryIds) -
          matchScore(a, preferredServiceIds, preferredCategoryIds);

        if (matchDiff !== 0) {
          return matchDiff;
        }

        const scoreDiff = profileScore(b) - profileScore(a);

        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return a.fullName.localeCompare(b.fullName, "tr");
      });

    setHasMore(ranked.length > 4);
    setProviders(ranked.slice(0, 4));
    setLoading(false);
  }

  if (loading) {
    return (
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
          Sana Önerilen Uzmanlar
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          İhtiyaçlarına uygun uzmanları keşfet.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`recommended-skeleton-${index}`}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
            >
              <div className="aspect-[4/3] animate-pulse bg-zinc-100" />
              <div className="space-y-3 p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-100" />
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
                </div>
                <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
                <div className="h-9 w-full animate-pulse rounded-lg bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (providers.length === 0) {
    return null;
  }

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
            Sana Önerilen Uzmanlar
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            İhtiyaçlarına uygun uzmanları keşfet.
          </p>
        </div>

        {hasMore ? (
          <Link
            href="/providers"
            className="text-sm font-medium text-violet-700 hover:text-violet-900"
          >
            Tüm Uzmanları Gör →
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {providers.map((provider) => {
          const bio = excerpt(provider.bio);
          const labels = Array.from(
            new Set(provider.services.map((item) => item.name)),
          ).slice(0, 3);
          const preview = provider.portfolio.find((item) => item.imageUrl);

          return (
            <article
              key={provider.id}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white"
            >
              <div className="relative aspect-[4/3] bg-zinc-100">
                {preview?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.imageUrl}
                    alt={preview.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-end p-3">
                    <p className="line-clamp-2 text-[11px] font-medium leading-4 text-zinc-500">
                      {provider.portfolio[0]?.title ?? "Portfolyo"}
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
                      {[provider.city, getWorkLabel(provider)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                {bio ? (
                  <p className="mt-3 text-sm leading-6 text-zinc-600">
                    {bio}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-zinc-400">
                    Henüz bio eklenmemiş.
                  </p>
                )}

                {labels.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {labels.map((label) => (
                      <span
                        key={`${provider.id}-${label}`}
                        className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-auto pt-5">
                  <Link
                    href={`/providers/${provider.id}`}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                  >
                    Profili Gör
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
