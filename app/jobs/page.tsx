"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getPreviewUser } from "@/lib/preview";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: number;
  customer_id: string;
  title: string;
  description: string;
  budget: number | null;
  city: string | null;
  location_type: string;
  status: string;
  service: {
    id: number;
    name: string;
    category: {
      id: number;
      name: string;
    } | null;
  } | null;
};

type ProviderOffer = {
  job_id: number;
  price: number;
  status: string;
};

type LocationFilter = "all" | "remote" | "on_site" | "hybrid";
type JobSort = "newest" | "budget_high" | "budget_low";

function parseBudgetInput(value: string) {
  const trimmed = value.trim().replace(/\./g, "").replace(",", ".");

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedJobIds, setSubmittedJobIds] = useState<number[]>([]);
  const [submittedOffers, setSubmittedOffers] = useState<
    Record<number, { price: number; status: string }>
  >({});
  const [isPreview, setIsPreview] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [locationFilter, setLocationFilter] =
    useState<LocationFilter>("all");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [sort, setSort] = useState<JobSort>("newest");

  async function loadJobs() {
    const supabase = createClient();

    setLoading(true);
    setError(null);

    const previewUser = getPreviewUser();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Giriş yapmalısın.");
      setLoading(false);
      return;
    }

    const effectiveUserId = previewUser?.id ?? user.id;
    const previewMode = previewUser !== null;

    setIsPreview(previewMode);

    let providerOffers: ProviderOffer[] = [];

    /*
     * Preview modunda seçilen uzman adına göre teklifleri
     * admin RPC üzerinden alıyoruz.
     *
     * Normal kullanımda mevcut RLS sistemi kullanılıyor.
     */
    if (previewMode) {
      const { data: previewOffers, error: offersError } =
        await supabase.rpc("admin_preview_provider_offers", {
          p_user_id: effectiveUserId,
        });

      if (offersError) {
        setError(
          `Teklifler yüklenirken bir hata oluştu: ${offersError.message}`,
        );
        setLoading(false);
        return;
      }

      providerOffers = (previewOffers ?? []) as ProviderOffer[];
    } else {
      const { data, error: offersError } = await supabase
        .from("offers")
        .select("job_id, price, status")
        .eq("provider_id", effectiveUserId);

      if (offersError) {
        setError(
          `Teklifler yüklenirken bir hata oluştu: ${offersError.message}`,
        );
        setLoading(false);
        return;
      }

      providerOffers = (data ?? []) as ProviderOffer[];
    }

    const submittedJobIdsFromDb = providerOffers.map(
      (offer) => offer.job_id,
    );

    let jobList: Job[] = [];

    if (previewMode) {
      /*
       * Preview modunda RLS'nin gerçek admin kullanıcısını değil,
       * seçilen uzmanı dikkate alması için admin RPC kullanıyoruz.
       */
      const { data, error } = await supabase.rpc(
        "admin_preview_provider_jobs",
        {
          p_user_id: effectiveUserId,
        },
      );

      if (error) {
        setError(
          `Uygun işler yüklenirken bir hata oluştu: ${error.message}`,
        );
        setLoading(false);
        return;
      }

      jobList = (
        (data ?? []) as Array<{
          id: number;
          customer_id: string;
          title: string;
          description: string;
          budget: number | null;
          city: string | null;
          location_type: string;
          status: string;
          service_id: number;
          service_name: string;
          category_id: number | null;
          category_name: string | null;
        }>
      ).map((job) => ({
        id: job.id,
        customer_id: job.customer_id,
        title: job.title,
        description: job.description,
        budget: job.budget,
        city: job.city,
        location_type: job.location_type,
        status: job.status,
        service: {
          id: job.service_id,
          name: job.service_name,
          category: job.category_id
            ? {
                id: job.category_id,
                name: job.category_name ?? "",
              }
            : null,
        },
      }));
    } else {
      /*
       * Normal kullanıcı:
       * Mevcut RLS + matching sistemi aynen çalışıyor.
       */
      const { data, error } = await supabase
        .from("jobs")
        .select(
          `
            id,
            customer_id,
            title,
            description,
            budget,
            city,
            location_type,
            status,
            service:services (
              id,
              name,
              category:categories (
                id,
                name
              )
            )
          `,
        )
        .eq("status", "open")
        .neq("customer_id", effectiveUserId)
        .order("created_at", { ascending: false });

      if (error) {
        setError(
          `Uygun işler yüklenirken bir hata oluştu: ${error.message}`,
        );
        setLoading(false);
        return;
      }

      jobList = (data as unknown as Job[]) ?? [];
    }

    setJobs(jobList);
    setSubmittedJobIds(submittedJobIdsFromDb);

    const offerMap: Record<
      number,
      { price: number; status: string }
    > = {};

    providerOffers.forEach((offer) => {
      offerMap[offer.job_id] = {
        price: offer.price,
        status: offer.status,
      };
    });

    setSubmittedOffers(offerMap);
    setLoading(false);
  }

  useEffect(() => {
    loadJobs();
  }, []);

  const categories = useMemo(() => {
    const names = new Set<string>();

    jobs.forEach((job) => {
      const name = job.service?.category?.name?.trim();

      if (name) {
        names.add(name);
      }
    });

    return [...names].sort((a, b) =>
      a.localeCompare(b, "tr"),
    );
  }, [jobs]);

  const services = useMemo(() => {
    const map = new Map<
      number,
      { id: number; name: string; categoryName: string }
    >();

    jobs.forEach((job) => {
      if (!job.service) {
        return;
      }

      const categoryName =
        job.service.category?.name?.trim() ?? "";

      if (
        categoryFilter &&
        categoryName !== categoryFilter
      ) {
        return;
      }

      map.set(job.service.id, {
        id: job.service.id,
        name: job.service.name,
        categoryName,
      });
    });

    return [...map.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "tr"),
    );
  }, [jobs, categoryFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    categoryFilter !== "" ||
    serviceFilter !== "" ||
    locationFilter !== "all" ||
    budgetMin.trim() !== "" ||
    budgetMax.trim() !== "" ||
    sort !== "newest";

  const filteredJobs = useMemo(() => {
    const search = searchQuery.trim().toLocaleLowerCase("tr-TR");
    const minBudget = parseBudgetInput(budgetMin);
    const maxBudget = parseBudgetInput(budgetMax);

    const next = jobs.filter((job) => {
      if (
        search &&
        !job.title
          .toLocaleLowerCase("tr-TR")
          .includes(search)
      ) {
        return false;
      }

      if (categoryFilter) {
        const categoryName =
          job.service?.category?.name?.trim() ?? "";

        if (categoryName !== categoryFilter) {
          return false;
        }
      }

      if (
        serviceFilter &&
        String(job.service?.id ?? "") !== serviceFilter
      ) {
        return false;
      }

      if (
        locationFilter !== "all" &&
        job.location_type !== locationFilter
      ) {
        return false;
      }

      if (minBudget !== null) {
        if (job.budget === null || job.budget < minBudget) {
          return false;
        }
      }

      if (maxBudget !== null) {
        if (job.budget === null || job.budget > maxBudget) {
          return false;
        }
      }

      return true;
    });

    if (sort === "budget_high") {
      return [...next].sort(
        (a, b) => (b.budget ?? -1) - (a.budget ?? -1),
      );
    }

    if (sort === "budget_low") {
      return [...next].sort(
        (a, b) =>
          (a.budget ?? Number.POSITIVE_INFINITY) -
          (b.budget ?? Number.POSITIVE_INFINITY),
      );
    }

    return next;
  }, [
    jobs,
    searchQuery,
    categoryFilter,
    serviceFilter,
    locationFilter,
    budgetMin,
    budgetMax,
    sort,
  ]);

  function clearFilters() {
    setSearchQuery("");
    setCategoryFilter("");
    setServiceFilter("");
    setLocationFilter("all");
    setBudgetMin("");
    setBudgetMax("");
    setSort("newest");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-zinc-500">Uygun işler yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      {isPreview && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Kullanıcı önizlemesi aktif. Bu sayfadaki işler seçilen uzman
          hesabına göre gösteriliyor.
        </div>
      )}

      <div className="mb-10">
        <p className="text-sm font-medium text-zinc-500">
          Uzman Paneli
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Uygun İşler
        </h1>

        <p className="mt-2 text-zinc-500">
          Hizmetlerine ve çalışma bölgene uygun açık işleri burada
          görebilirsin.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {jobs.length > 0 && (
        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-700">
                Arama
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                placeholder="İlan başlığı"
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
              <span className="font-medium text-zinc-700">
                Hizmet
              </span>
              <select
                value={serviceFilter}
                onChange={(event) =>
                  setServiceFilter(event.target.value)
                }
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="">Tümü</option>
                {services.map((service) => (
                  <option
                    key={service.id}
                    value={String(service.id)}
                  >
                    {service.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1.5 text-sm sm:col-span-2 lg:col-span-1">
              <span className="font-medium text-zinc-700">
                Çalışma şekli
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLocationFilter("all")}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    locationFilter === "all"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Tümü
                </button>
                <button
                  type="button"
                  onClick={() => setLocationFilter("remote")}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    locationFilter === "remote"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Uzaktan
                </button>
                <button
                  type="button"
                  onClick={() => setLocationFilter("on_site")}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    locationFilter === "on_site"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Yerinde
                </button>
                <button
                  type="button"
                  onClick={() => setLocationFilter("hybrid")}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    locationFilter === "hybrid"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Hibrit
                </button>
              </div>
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-700">
                Min. bütçe
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={budgetMin}
                onChange={(event) =>
                  setBudgetMin(event.target.value)
                }
                placeholder="Örn. 5000"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-700">
                Maks. bütçe
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={budgetMax}
                onChange={(event) =>
                  setBudgetMax(event.target.value)
                }
                placeholder="Örn. 20000"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex flex-col gap-1.5 text-sm sm:w-56">
              <span className="font-medium text-zinc-700">
                Sıralama
              </span>
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as JobSort)
                }
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="newest">En yeni</option>
                <option value="budget_high">Bütçesi yüksek</option>
                <option value="budget_low">Bütçesi düşük</option>
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-3 sm:pt-6">
              <p className="text-sm text-zinc-500">
                {filteredJobs.length} / {jobs.length} ilan
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
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center">
          <h2 className="text-lg font-medium">
            Şu anda sana uygun açık iş yok.
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Profilindeki hizmetleri ve çalışma bölgelerini
            güncellediğinde daha fazla iş görebilirsin.
          </p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center">
          <h2 className="text-lg font-medium">
            Bu filtrelere uyan iş yok.
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
          {filteredJobs.map((job) => {
            const submittedOffer = submittedOffers[job.id];

            const categoryName =
              job.service?.category?.name?.trim() ?? "";

            const serviceName =
              job.service?.name?.trim() ?? "";

            const showCategory =
              categoryName !== "" &&
              categoryName.toLocaleLowerCase("tr-TR") !==
                serviceName.toLocaleLowerCase("tr-TR");

            return (
              <article
                key={job.id}
                onClick={(event) => {
                  const target =
                    event.target as HTMLElement;

                  if (
                    target.closest(
                      "a, button",
                    )
                  ) {
                    return;
                  }

                  router.push(
                    `/jobs/${job.id}`,
                  );
                }}
                className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-zinc-300"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {showCategory && (
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                          {categoryName}
                        </span>
                      )}

                      {serviceName && (
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                          {serviceName}
                        </span>
                      )}

                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                        Açık
                      </span>
                    </div>

                    <h2 className="text-xl font-semibold text-zinc-950">
                      {job.title}
                    </h2>

                    <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                      {job.description}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-xl bg-zinc-50 px-5 py-4 sm:min-w-32">
                    <p className="text-xs text-zinc-500">
                      Proje bütçesi
                    </p>

                    <p className="mt-1 text-lg font-semibold text-zinc-950">
                      {job.budget
                        ? `${job.budget.toLocaleString("tr-TR")} TL`
                        : "Belirtilmedi"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4 border-t border-zinc-100 pt-5">
                  <div>
                    <p className="text-xs text-zinc-400">
                      Konum
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {job.city ?? "Belirtilmedi"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-400">
                      Çalışma şekli
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {job.location_type === "remote"
                        ? "Uzaktan"
                        : job.location_type === "on_site"
                          ? "Yerinde"
                          : "Hibrit"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 border-t border-zinc-100 pt-5">
                  {submittedJobIds.includes(job.id) ? (
                    <div
                      className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                        submittedOffer?.status === "accepted"
                          ? "bg-green-50 text-green-700"
                          : submittedOffer?.status === "rejected"
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      {submittedOffer?.status === "accepted"
                        ? "✓ Teklifin kabul edildi"
                        : submittedOffer?.status === "rejected"
                          ? "✕ Teklifin reddedildi"
                          : "✓ Teklif verdin"}{" "}
                      —{" "}
                      {submittedOffer?.price.toLocaleString("tr-TR")} TL
                    </div>
                  ) : isPreview ? (
                    <button
                      type="button"
                      disabled
                      className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Önizlemede Teklif Verilemez
                    </button>
                  ) : (
                    <Link
                      href={`/jobs/${job.id}/offer`}
                      className="inline-flex rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                    >
                      Teklif Ver
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}