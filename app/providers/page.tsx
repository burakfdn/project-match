"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { getPreviewUser } from "@/lib/preview";

type WorkModeFilter = "all" | "remote" | "on_site" | "both";

type ProviderCard = {
  id: string;
  fullName: string;
  city: string | null;
  experienceYears: number;
  canWorkRemote: boolean;
  canWorkOnSite: boolean;
  services: {
    id: number;
    name: string;
    categoryName: string;
  }[];
  workSampleCount: number;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  experience_years: number | null;
  city: string | null;
  can_work_remote: boolean | null;
  can_work_on_site: boolean | null;
  bio: string | null;
};

type ServiceRow = {
  provider_id: string;
  service_id: number;
  service_name: string;
  category_id: number | null;
  category_name: string | null;
};

function getWorkLabel(provider: ProviderCard) {
  if (provider.canWorkRemote && provider.canWorkOnSite) {
    return "Uzaktan + Yerinde";
  }

  if (provider.canWorkRemote) {
    return "Uzaktan";
  }

  if (provider.canWorkOnSite) {
    return "Yerinde";
  }

  return "Belirtilmemiş";
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [workModeFilter, setWorkModeFilter] =
    useState<WorkModeFilter>("all");

  useEffect(() => {
    loadProviders();
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

    const [
      profilesResult,
      servicesResult,
    ] = await Promise.all([
      supabase.rpc("discover_providers"),
      supabase.rpc("discover_provider_services"),
    ]);

    if (profilesResult.error) {
      console.error(
        "discover_providers error:",
        profilesResult.error,
      );
      setError(
        profilesResult.error.message ||
          "Uzman listesi yüklenirken bir hata oluştu.",
      );
      setProviders([]);
      setLoading(false);
      return;
    }

    if (servicesResult.error) {
      console.error(
        "discover_provider_services error:",
        servicesResult.error,
      );
      setError(
        servicesResult.error.message ||
          "Uzman hizmetleri yüklenirken bir hata oluştu.",
      );
      setProviders([]);
      setLoading(false);
      return;
    }

    const profileRows = (profilesResult.data ?? []) as ProfileRow[];
    const candidateIds = profileRows
      .map((row) => row.user_id)
      .filter((id) => id && id !== viewerId);

    const workCountByProvider: Record<string, number> = {};

    if (candidateIds.length > 0) {
      const workSamplesResult = await supabase
        .from("provider_work_samples")
        .select("id, provider_id")
        .in("provider_id", candidateIds);

      if (workSamplesResult.error) {
        console.error(
          "provider_work_samples error:",
          workSamplesResult.error,
        );
      } else {
        for (const sample of workSamplesResult.data ?? []) {
          const providerId = sample.provider_id as string;
          workCountByProvider[providerId] =
            (workCountByProvider[providerId] ?? 0) + 1;
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
          city: row.city,
          experienceYears: Number(row.experience_years ?? 0),
          canWorkRemote: Boolean(row.can_work_remote),
          canWorkOnSite: Boolean(row.can_work_on_site),
          services: servicesByProvider[id] ?? [],
          workSampleCount: workCountByProvider[id] ?? 0,
        };
      })
      .filter((item): item is ProviderCard => item !== null);

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
        if (
          categoryFilter &&
          service.categoryName !== categoryFilter
        ) {
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
      const city = provider.city?.trim();

      if (city) {
        names.add(city);
      }
    });

    return [...names].sort((a, b) => a.localeCompare(b, "tr"));
  }, [providers]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    categoryFilter !== "" ||
    serviceFilter !== "" ||
    cityFilter !== "" ||
    workModeFilter !== "all";

  const filteredProviders = useMemo(() => {
    const search = searchQuery.trim().toLocaleLowerCase("tr-TR");

    return providers.filter((provider) => {
      if (
        search &&
        !provider.fullName
          .toLocaleLowerCase("tr-TR")
          .includes(search)
      ) {
        return false;
      }

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

      if (cityFilter && provider.city?.trim() !== cityFilter) {
        return false;
      }

      if (workModeFilter === "remote" && !provider.canWorkRemote) {
        return false;
      }

      if (workModeFilter === "on_site" && !provider.canWorkOnSite) {
        return false;
      }

      if (
        workModeFilter === "both" &&
        !(provider.canWorkRemote && provider.canWorkOnSite)
      ) {
        return false;
      }

      return true;
    });
  }, [
    providers,
    searchQuery,
    categoryFilter,
    serviceFilter,
    cityFilter,
    workModeFilter,
  ]);

  function clearFilters() {
    setSearchQuery("");
    setCategoryFilter("");
    setServiceFilter("");
    setCityFilter("");
    setWorkModeFilter("all");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-sm text-zinc-500">Uzmanlar yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10">
        <p className="text-sm font-medium text-zinc-500">
          Proje Sahibi Paneli
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Uzmanlar
        </h1>

        <p className="mt-2 text-zinc-500">
          Hizmet verebilecek uzmanları keşfet, profillerini incele
          ve mevcut ilanların üzerinden teklif al.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {providers.length > 0 && (
        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-700">Arama</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Uzman adı"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-700">
                Kategori
              </span>
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
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-zinc-700">
              Çalışma şekli
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Tümü"],
                  ["remote", "Uzaktan"],
                  ["on_site", "Yerinde"],
                  ["both", "Her ikisi"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setWorkModeFilter(value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
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

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-zinc-500">
              {filteredProviders.length} / {providers.length} uzman
            </p>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Filtreleri temizle
              </button>
            )}
          </div>
        </div>
      )}

      {providers.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center">
          <h2 className="text-lg font-medium">
            Şu anda listelenecek uzman yok.
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Uzman profilleri oluştukça burada görünecek.
          </p>
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center">
          <h2 className="text-lg font-medium">
            Bu filtrelere uyan uzman yok.
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Arama veya filtreleri değiştirerek tekrar dene.
          </p>

          <button
            type="button"
            onClick={clearFilters}
            className="mt-5 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Filtreleri temizle
          </button>
        </div>
      ) : (
        <div className="grid gap-5">
          {filteredProviders.map((provider) => (
            <article
              key={provider.id}
              className="rounded-2xl border border-zinc-200 bg-white p-6"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-zinc-950">
                    {provider.fullName}
                  </h2>

                  <p className="mt-2 text-sm text-zinc-500">
                    {provider.city || "Şehir belirtilmemiş"}
                    {" · "}
                    {provider.experienceYears} yıl deneyim
                    {" · "}
                    {getWorkLabel(provider)}
                  </p>

                  {provider.services.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {provider.services.slice(0, 6).map((service) => (
                        <span
                          key={`${provider.id}-${service.id}`}
                          className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700"
                        >
                          {service.name}
                        </span>
                      ))}

                      {provider.services.length > 6 && (
                        <span className="rounded-full bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-500">
                          +{provider.services.length - 6}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="mt-4 text-sm text-zinc-500">
                    {provider.workSampleCount > 0
                      ? `${provider.workSampleCount} portfolyo çalışması`
                      : "Henüz portfolyo çalışması yok"}
                  </p>
                </div>

                <Link
                  href={`/providers/${provider.id}`}
                  className="inline-flex shrink-0 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                >
                  Profili Gör
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
