"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getPreviewUser } from "@/lib/preview";

type WorkModeFilter = "all" | "remote" | "on_site" | "hybrid";

type PortfolioPreview = {
  id: number;
  title: string;
  imageUrl: string | null;
};

type ProviderService = {
  service_id: number;
  name: string;
  category_id: number | null;
  categoryName: string;
};

type ProviderCard = {
  id: string;
  fullName: string;
  bio: string | null;
  city: string | null;
  canWorkRemote: boolean;
  canWorkOnSite: boolean;
  services: ProviderService[];
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

type CatalogService = {
  id: number;
  name: string;
  category_id: number | null;
  categoryName: string | null;
};

type WorkSampleRow = {
  id: number;
  provider_id: string;
  title: string | null;
  project_url: string | null;
};

function asPositiveInt(value: unknown): number | null {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function readProviderId(row: Record<string, unknown>) {
  const raw = row.provider_id ?? row.user_id ?? row.providerId;
  return raw == null ? "" : String(raw);
}

function readServiceId(row: Record<string, unknown>) {
  return asPositiveInt(row.service_id ?? row.serviceId);
}

function readCategoryId(row: Record<string, unknown>) {
  return asPositiveInt(row.category_id ?? row.categoryId);
}

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

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
}

function matchesSearchQuery(provider: ProviderCard, query: string) {
  const tokens = normalizeSearchText(query)
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return true;
  }

  const haystack = normalizeSearchText(
    [
      provider.fullName,
      provider.bio ?? "",
      ...provider.services.map((service) => service.name),
      ...provider.services.map((service) => service.categoryName),
    ].join(" "),
  );

  return tokens.every((token) => haystack.includes(token));
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [workModeFilter, setWorkModeFilter] =
    useState<WorkModeFilter>("all");
  const [queryFilter, setQueryFilter] = useState("");
  const [filtersReady, setFiltersReady] = useState(false);

  useEffect(() => {
    const serviceParam = searchParams.get("service")?.trim() ?? "";
    const categoryParam = searchParams.get("category")?.trim() ?? "";
    const queryParam = searchParams.get("q") ?? "";

    setServiceFilter(serviceParam);
    setCategoryFilter(categoryParam);
    setQueryFilter(queryParam);
    setFiltersReady(true);
  }, [searchParams]);

  useEffect(() => {
    void loadProviders();
  }, []);

  function syncFilterUrl(
    nextCategory: string,
    nextService: string,
    nextSearch: string,
  ) {
    const params = new URLSearchParams();

    if (nextCategory) {
      params.set("category", nextCategory);
    }

    if (nextService) {
      params.set("service", nextService);
    }

    const trimmedSearch = nextSearch.trim();

    if (trimmedSearch) {
      params.set("q", trimmedSearch);
    }

    const nextQuery = params.toString();
    const currentQuery = new URLSearchParams();
    const currentCategory = searchParams.get("category")?.trim() ?? "";
    const currentService = searchParams.get("service")?.trim() ?? "";
    const currentSearch = searchParams.get("q")?.trim() ?? "";

    if (currentCategory) {
      currentQuery.set("category", currentCategory);
    }

    if (currentService) {
      currentQuery.set("service", currentService);
    }

    if (currentSearch) {
      currentQuery.set("q", currentSearch);
    }

    if (currentQuery.toString() === nextQuery) {
      return;
    }

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }

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

    const [profilesResult, servicesResult, catalogResult] = await Promise.all([
      supabase.rpc("discover_providers"),
      supabase.rpc("discover_provider_services"),
      supabase.from("services").select(
        `
          id,
          name,
          category_id,
          category:categories (
            id,
            name
          )
        `,
      ),
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

    const catalogById = new Map<number, CatalogService>();

    if (!catalogResult.error) {
      for (const row of (catalogResult.data ?? []) as Array<{
        id: number;
        name: string | null;
        category_id: number | null;
        category?:
          | { id?: number; name?: string | null }
          | Array<{ id?: number; name?: string | null }>
          | null;
      }>) {
        const id = asPositiveInt(row.id);

        if (!id) {
          continue;
        }

        const nestedCategory = Array.isArray(row.category)
          ? row.category[0]
          : row.category;

        catalogById.set(id, {
          id,
          name: row.name?.trim() || "Hizmet",
          category_id: asPositiveInt(row.category_id ?? nestedCategory?.id),
          categoryName: nestedCategory?.name?.trim() || null,
        });
      }
    } else {
      console.error("services catalog error:", catalogResult.error);
    }

    const serviceRows = (
      Array.isArray(servicesResult.data)
        ? servicesResult.data
        : servicesResult.data
          ? [servicesResult.data]
          : []
    ) as Array<Record<string, unknown>>;
    const servicesByProvider: Record<string, ProviderCard["services"]> =
      {};

    for (const row of serviceRows) {
      const providerId = readProviderId(row).trim().toLowerCase();
      const serviceId = readServiceId(row);

      if (!providerId || !serviceId) {
        continue;
      }

      const catalog = catalogById.get(serviceId);
      const categoryId =
        readCategoryId(row) ?? catalog?.category_id ?? null;
      const serviceName =
        (typeof row.service_name === "string" && row.service_name.trim()
          ? row.service_name.trim()
          : catalog?.name) || "Hizmet";
      const categoryName =
        (typeof row.category_name === "string" && row.category_name.trim()
          ? row.category_name.trim()
          : catalog?.categoryName) || "Diğer";

      if (!servicesByProvider[providerId]) {
        servicesByProvider[providerId] = [];
      }

      if (
        servicesByProvider[providerId].some(
          (item) => item.service_id === serviceId,
        )
      ) {
        continue;
      }

      servicesByProvider[providerId].push({
        service_id: serviceId,
        name: serviceName,
        category_id: categoryId,
        categoryName,
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
          services: servicesByProvider[id.trim().toLowerCase()] ?? [],
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
    const map = new Map<number, string>();

    providers.forEach((provider) => {
      provider.services.forEach((service) => {
        if (service.category_id) {
          map.set(service.category_id, service.categoryName);
        }
      });
    });

    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [providers]);

  const services = useMemo(() => {
    const selectedCategoryId = asPositiveInt(categoryFilter);
    const map = new Map<number, { service_id: number; name: string }>();

    providers.forEach((provider) => {
      provider.services.forEach((service) => {
        if (
          selectedCategoryId &&
          Number(service.category_id) !== selectedCategoryId
        ) {
          return;
        }

        map.set(service.service_id, {
          service_id: service.service_id,
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
    workModeFilter !== "all" ||
    queryFilter.trim() !== "";

  const filteredProviders = useMemo(() => {
    const selectedCategoryId = asPositiveInt(categoryFilter);
    const selectedServiceId = asPositiveInt(serviceFilter);

    return providers.filter((provider) => {
      if (!matchesSearchQuery(provider, queryFilter)) {
        return false;
      }

      if (selectedCategoryId) {
        const hasCategory = provider.services.some(
          (service) => Number(service.category_id) === selectedCategoryId,
        );

        if (!hasCategory) {
          return false;
        }
      }

      if (serviceFilter) {
        if (!selectedServiceId) {
          return false;
        }

        const hasService = provider.services.some((service) => {
          const serviceMatches =
            Number(service.service_id) === selectedServiceId;

          if (!serviceMatches) {
            return false;
          }

          if (!selectedCategoryId) {
            return true;
          }

          return Number(service.category_id) === selectedCategoryId;
        });

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
    queryFilter,
  ]);

  function updateCategoryFilter(nextCategory: string) {
    const selectedCategoryId = asPositiveInt(nextCategory);
    const selectedServiceId = asPositiveInt(serviceFilter);
    let nextService = serviceFilter;

    if (selectedCategoryId && selectedServiceId) {
      const stillValid = providers.some((provider) =>
        provider.services.some(
          (service) =>
            Number(service.service_id) === selectedServiceId &&
            Number(service.category_id) === selectedCategoryId,
        ),
      );

      if (!stillValid) {
        nextService = "";
      }
    } else if (selectedCategoryId) {
      nextService = "";
    }

    setCategoryFilter(nextCategory);
    setServiceFilter(nextService);
    syncFilterUrl(nextCategory, nextService, queryFilter);
  }

  function updateServiceFilter(nextService: string) {
    setServiceFilter(nextService);
    syncFilterUrl(categoryFilter, nextService, queryFilter);
  }

  function updateQueryFilter(nextQuery: string) {
    setQueryFilter(nextQuery);
    syncFilterUrl(categoryFilter, serviceFilter, nextQuery);
  }

  function clearFilters() {
    setCategoryFilter("");
    setServiceFilter("");
    setCityFilter("");
    setWorkModeFilter("all");
    setQueryFilter("");
    syncFilterUrl("", "", "");
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

        {loading || !filtersReady ? (
          <p className="text-sm text-zinc-500">Uzmanlar yükleniyor...</p>
        ) : (
          <>
            <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
              <label className="mb-4 flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-700">Ara</span>
                <input
                  type="search"
                  value={queryFilter}
                  onChange={(event) => {
                    updateQueryFilter(event.target.value);
                  }}
                  placeholder="Uzman, hizmet veya anahtar kelime ara"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-zinc-400 sm:py-2 sm:text-sm"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700">Kategori</span>
                  <select
                    value={categoryFilter}
                    onChange={(event) => {
                      updateCategoryFilter(event.target.value);
                    }}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="">Tümü</option>
                    {categories.map((category) => (
                      <option key={category.id} value={String(category.id)}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-zinc-700">Hizmet</span>
                  <select
                    value={serviceFilter}
                    onChange={(event) =>
                      updateServiceFilter(event.target.value)
                    }
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="">Tümü</option>
                    {services.map((service) => (
                      <option
                        key={service.service_id}
                        value={String(service.service_id)}
                      >
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
                  {queryFilter.trim()
                    ? "Aramana uygun uzman bulunamadı."
                    : "Bu kriterlere uygun uzman bulunamadı."}
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
