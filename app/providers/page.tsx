"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { getPreviewUser } from "@/lib/preview";

type WorkModeFilter = "all" | "remote" | "on_site" | "hybrid";

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

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [workModeFilter, setWorkModeFilter] =
    useState<WorkModeFilter>("all");

  useEffect(() => {
    void loadProviders();
  }, []);

  async function loadProviders() {
    const supabase = createClient();

    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Uzmanları görmek için giriş yapmalısın.");
      setProviders([]);
      setLoading(false);
      return;
    }

    const previewUser = getPreviewUser();
    const viewerId = previewUser?.id ?? user.id;

    const [profilesResult, servicesResult] = await Promise.all([
      supabase.rpc("discover_providers"),
      supabase.rpc("discover_provider_services"),
    ]);

    if (profilesResult.error) {
      console.error("discover_providers error:", profilesResult.error);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setProviders([]);
      setLoading(false);
      return;
    }

    if (servicesResult.error) {
      console.error(
        "discover_provider_services error:",
        servicesResult.error,
      );
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setProviders([]);
      setLoading(false);
      return;
    }

    const profileRows = (profilesResult.data ?? []) as ProfileRow[];
    const candidateIds = profileRows
      .map((row) => row.user_id)
      .filter((id) => id && id !== viewerId);

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
    const servicesByProvider: Record<string, ProviderCard["services"]> =
      {};

    for (const service of serviceRows) {
      if (!servicesByProvider[service.provider_id]) {
        servicesByProvider[service.provider_id] = [];
      }

      servicesByProvider[service.provider_id].push({
        id: service.service_id,
        name: service.service_name,
        categoryName: service.category_name?.trim() || "Diğer",
      });
    }

    const nextProviders: ProviderCard[] = profileRows
      .map((row) => {
        const id = row.user_id;

        if (!id || id === viewerId) {
          return null;
        }

        return {
          id,
          fullName: row.full_name?.trim() || "İsimsiz Uzman",
          bio: row.bio?.trim() || null,
          city: row.city?.trim() || null,
          canWorkRemote: Boolean(row.can_work_remote),
          canWorkOnSite: Boolean(row.can_work_on_site),
          services: servicesByProvider[id] ?? [],
          portfolio: samplesByProvider[id] ?? [],
        };
      })
      .filter((item): item is ProviderCard => item !== null)
      .sort((a, b) => {
        const scoreDiff = profileScore(b) - profileScore(a);

        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return a.fullName.localeCompare(b.fullName, "tr");
      });

    setProviders(nextProviders);
    setLoading(false);
  }

  const categories = useMemo(() => {
    const names = new Set<string>();

    providers.forEach((provider) => {
      provider.services.forEach((service) => {
        if (service.categoryName) {
          names.add(service.categoryName);
        }
      });
    });

    return [...names].sort((a, b) => a.localeCompare(b, "tr"));
  }, [providers]);

  const services = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();

    providers.forEach((provider) => {
      provider.services.forEach((service) => {
        if (categoryFilter && service.categoryName !== categoryFilter) {
          return;
        }

        map.set(service.id, {
          id: service.id,
          name: service.name,
        });
      });
    });

    return [...map.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "tr"),
    );
  }, [providers, categoryFilter]);

  const cities = useMemo(() => {
    const names = new Set<string>();

    providers.forEach((provider) => {
      if (provider.city) {
        names.add(provider.city);
      }
    });

    return [...names].sort((a, b) => a.localeCompare(b, "tr"));
  }, [providers]);

  const hasActiveFilters =
    categoryFilter !== "" ||
    serviceFilter !== "" ||
    cityFilter !== "" ||
    workModeFilter !== "all";

  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      if (categoryFilter) {
        const hasCategory = provider.services.some(
          (service) => service.categoryName === categoryFilter,
        );

        if (!hasCategory) {
          return false;
        }
      }

      if (serviceFilter) {
        const hasService = provider.services.some(
          (service) => String(service.id) === serviceFilter,
        );

        if (!hasService) {
          return false;
        }
      }

      if (cityFilter && provider.city !== cityFilter) {
        return false;
      }

      if (workModeFilter === "remote" && !provider.canWorkRemote) {
        return false;
      }

      if (workModeFilter === "on_site" && !provider.canWorkOnSite) {
        return false;
      }

      if (
        workModeFilter === "hybrid" &&
        !(provider.canWorkRemote && provider.canWorkOnSite)
      ) {
        return false;
      }

      return true;
    });
  }, [
    providers,
    categoryFilter,
    serviceFilter,
    cityFilter,
    workModeFilter,
  ]);

  function clearFilters() {
    setCategoryFilter("");
    setServiceFilter("");
    setCityFilter("");
    setWorkModeFilter("all");
  }

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10 max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Uzmanları Keşfet
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500 sm:text-base">
            İhtiyacın için doğru uzmanı bul, çalışmalarını incele ve birlikte
            çalışmaya başla.
          </p>
        </div>

        {error ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => {
                void loadProviders();
              }}
              className="text-sm font-medium text-red-800 underline-offset-2 hover:underline"
            >
              Tekrar dene
            </button>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500">Uzmanlar yükleniyor...</p>
        ) : (
          <>
            <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700">Kategori</span>
                  <select
                    value={categoryFilter}
                    onChange={(event) => {
                      setCategoryFilter(event.target.value);
                      setServiceFilter("");
                    }}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="">Tümü</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700">Hizmet</span>
                  <select
                    value={serviceFilter}
                    onChange={(event) =>
                      setServiceFilter(event.target.value)
                    }
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="">Tümü</option>
                    {services.map((service) => (
                      <option key={service.id} value={String(service.id)}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700">Şehir</span>
                  <select
                    value={cityFilter}
                    onChange={(event) => setCityFilter(event.target.value)}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="">Tümü</option>
                    {cities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <p className="mb-1.5 text-sm font-medium text-zinc-700">
                    Çalışma şekli
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["all", "Tümü"],
                        ["remote", "Uzaktan"],
                        ["on_site", "Yerinde"],
                        ["hybrid", "Hibrit"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setWorkModeFilter(value)}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition sm:text-sm ${
                          workModeFilter === value
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-sm text-zinc-500">
                  {filteredProviders.length} uzman
                </p>

                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
                  >
                    Filtreleri Temizle
                  </button>
                ) : null}
              </div>
            </div>

            {filteredProviders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center">
                <p className="text-sm text-zinc-500">
                  Bu kriterlere uygun uzman bulunamadı.
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 text-sm font-medium text-zinc-800 underline-offset-2 hover:underline"
                  >
                    Filtreleri Temizle
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProviders.map((provider) => {
                  const bio = excerpt(provider.bio);
                  const labels = Array.from(
                    new Set([
                      ...provider.services.map((item) => item.categoryName),
                      ...provider.services.map((item) => item.name),
                    ]),
                  ).slice(0, 5);

                  return (
                    <article
                      key={provider.id}
                      className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white"
                    >
                      <div className="grid grid-cols-3 gap-px bg-zinc-200">
                        {Array.from({ length: 3 }).map((_, index) => {
                          const sample = provider.portfolio[index];

                          return (
                            <div
                              key={`${provider.id}-sample-${index}`}
                              className="relative aspect-[4/3] bg-zinc-100"
                            >
                              {sample?.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={sample.imageUrl}
                                  alt={sample.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-end p-2">
                                  <p className="line-clamp-2 text-[11px] font-medium leading-4 text-zinc-500">
                                    {sample?.title ?? "Portfolyo"}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">
                            {getInitials(provider.fullName)}
                          </div>
                          <div className="min-w-0">
                            <h2 className="truncate text-base font-semibold text-zinc-950">
                              {provider.fullName}
                            </h2>
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

                        <Link
                          href={`/providers/${provider.id}`}
                          className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                        >
                          Profili Gör
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
