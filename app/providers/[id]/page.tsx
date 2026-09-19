"use client";

import { useEffect, useState } from "react";

import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type ProviderProfile = {
  user_id: string;
  full_name: string | null;
  bio: string | null;
  experience_years: number;
  city: string | null;
  location_type: "remote" | "on_site" | "hybrid";
  can_work_remote: boolean;
  can_work_on_site: boolean;
};

type ProviderService = {
  id: number;
  name: string;
  category: {
    id: number;
    name: string;
  } | null;
};

type ProviderServiceRow = {
  provider_id: string;
  service_id: number;
  service_name: string;
  category_id: number | null;
  category_name: string | null;
};

type DiscoverProviderRow = {
  user_id: string;
  full_name: string | null;
  experience_years: number | null;
  city: string | null;
  can_work_remote: boolean | null;
  can_work_on_site: boolean | null;
  bio: string | null;
};

type WorkSampleCategoryNested = {
  id: number;
  name: string;
};

type WorkSampleCategoryRow = {
  category_id: number;
  category:
    | WorkSampleCategoryNested
    | WorkSampleCategoryNested[]
    | null;
};

type WorkSampleServiceNested = {
  id: number;
  name: string;
};

type WorkSampleServiceRow = {
  service_id: number;
  service:
    | WorkSampleServiceNested
    | WorkSampleServiceNested[]
    | null;
};

type WorkSampleRow = {
  id: number;
  title: string;
  description: string | null;
  project_url: string | null;
  created_at: string;
  work_sample_categories:
    | WorkSampleCategoryRow[]
    | WorkSampleCategoryRow
    | null;
  work_sample_services:
    | WorkSampleServiceRow[]
    | WorkSampleServiceRow
    | null;
};

type WorkSample = {
  id: number;
  title: string;
  description: string | null;
  projectUrl: string | null;
  createdAt: string;
  categories: {
    id: number;
    name: string;
  }[];
  services: {
    id: number;
    name: string;
  }[];
};

export default function ProviderProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  const providerId =
    typeof params.id === "string"
      ? params.id
      : "";

  const [profile, setProfile] =
    useState<ProviderProfile | null>(null);

  const [services, setServices] =
    useState<ProviderService[]>([]);

  const [workSamples, setWorkSamples] =
    useState<WorkSample[]>([]);

  const [workSamplesError, setWorkSamplesError] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [customerEnabled, setCustomerEnabled] =
    useState(false);

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [reviewSummary, setReviewSummary] = useState<{
    average: string;
    count: number;
  } | null>(null);

  const [reviews, setReviews] = useState<
    Array<{
      rating: number;
      comment: string | null;
      created_at: string;
    }>
  >([]);

  const [showReviews, setShowReviews] = useState(false);

  const [completedProjectCount, setCompletedProjectCount] =
    useState(0);

  useEffect(() => {
    if (!providerId) {
      setError("Uzman bulunamadı.");
      setLoading(false);
      return;
    }

    loadProfile();
  }, [providerId]);

  async function loadProfile() {
    setLoading(true);
    setError("");
    setWorkSamplesError("");
    setReviewSummary(null);
    setReviews([]);
    setShowReviews(false);
    setCompletedProjectCount(0);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id ?? null);

    if (user) {
      const { data: permissionProfile } = await supabase
        .from("profiles")
        .select("customer_enabled")
        .eq("id", user.id)
        .maybeSingle();

      setCustomerEnabled(
        Boolean(permissionProfile?.customer_enabled),
      );
    } else {
      setCustomerEnabled(false);
    }

    const {
      data: profileData,
      error: profileError,
    } = await supabase.rpc("discover_providers");

    if (profileError) {
      console.error(
        "discover_providers error:",
        profileError,
      );

      setError(
        profileError.message ||
          "Uzman profili yüklenirken bir hata oluştu.",
      );

      setLoading(false);
      return;
    }

    const profiles = (
      Array.isArray(profileData)
        ? profileData
        : profileData
          ? [profileData]
          : []
    ) as DiscoverProviderRow[];

    const providerRow =
      profiles.find(
        (item) =>
          String(item.user_id).toLowerCase() ===
          providerId.toLowerCase(),
      ) ?? null;

    if (!providerRow) {
      setError(
        "Bu uzmanın profili görüntülenemiyor.",
      );

      setLoading(false);
      return;
    }

    const provider: ProviderProfile = {
      user_id: providerRow.user_id,
      full_name: providerRow.full_name,
      bio: providerRow.bio,
      experience_years: Number(
        providerRow.experience_years ?? 0,
      ),
      city: providerRow.city,
      can_work_remote: Boolean(
        providerRow.can_work_remote,
      ),
      can_work_on_site: Boolean(
        providerRow.can_work_on_site,
      ),
      location_type:
        providerRow.can_work_remote &&
        providerRow.can_work_on_site
          ? "hybrid"
          : providerRow.can_work_on_site
            ? "on_site"
            : "remote",
    };

    const {
      data: servicesData,
      error: servicesError,
    } = await supabase.rpc(
      "discover_provider_services",
    );

    if (servicesError) {
      console.error(
        "discover_provider_services error:",
        servicesError,
      );
    }

    const serviceRows = (
      Array.isArray(servicesData)
        ? servicesData
        : servicesData
          ? [servicesData]
          : []
    ) as ProviderServiceRow[];

    const providerServiceRows = serviceRows.filter(
      (service) =>
        String(service.provider_id).toLowerCase() ===
        providerId.toLowerCase(),
    );

    const normalizedServices =
      providerServiceRows.map((service) => ({
        id: service.service_id,
        name: service.service_name,
        category:
          service.category_id
            ? {
                id: service.category_id,
                name:
                  service.category_name ??
                  "",
              }
            : null,
      }));

    const {
      data: workSamplesData,
      error: workSamplesQueryError,
    } = await supabase
      .from("provider_work_samples")
      .select(
        `
          id,
          title,
          description,
          project_url,
          created_at,
          work_sample_categories (
            category_id,
            category:categories (
              id,
              name
            )
          ),
          work_sample_services (
            service_id,
            service:services (
              id,
              name
            )
          )
        `,
      )
      .eq("provider_id", providerId)
      .order("created_at", {
        ascending: false,
      });

    if (workSamplesQueryError) {
      console.error(
        "Provider work samples error:",
        workSamplesQueryError,
      );

      setWorkSamplesError(
        "Portfolyo çalışmaları yüklenemedi.",
      );
      setWorkSamples([]);
    } else {
      setWorkSamplesError("");
      setWorkSamples(
        normalizeWorkSamples(
          (workSamplesData ??
            []) as WorkSampleRow[],
        ),
      );
    }

    setProfile(provider);
    setServices(normalizedServices);

    const { data: reviewsData, error: reviewsError } =
      await supabase
        .from("reviews")
        .select("rating, comment, created_at")
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false });

    if (reviewsError) {
      console.error(
        "Provider reviews error:",
        reviewsError,
      );
      setReviewSummary(null);
      setReviews([]);
    } else {
      const normalizedReviews = (reviewsData ?? []).map(
        (row) => ({
          rating: Number(row.rating),
          comment:
            typeof row.comment === "string" &&
            row.comment.trim()
              ? row.comment.trim()
              : null,
          created_at: String(row.created_at ?? ""),
        }),
      );

      const ratings = normalizedReviews
        .map((row) => row.rating)
        .filter((rating) => Number.isFinite(rating));

      setReviews(normalizedReviews);

      if (ratings.length === 0) {
        setReviewSummary(null);
      } else {
        const total = ratings.reduce(
          (sum, rating) => sum + rating,
          0,
        );
        const average = total / ratings.length;

        setReviewSummary({
          average: (Math.round(average * 10) / 10).toFixed(1),
          count: ratings.length,
        });
      }
    }

    const { data: acceptedOffersData, error: acceptedOffersError } =
      await supabase
        .from("offers")
        .select("job_id")
        .eq("provider_id", providerId)
        .eq("status", "accepted");

    if (acceptedOffersError) {
      console.error(
        "Provider completed projects error:",
        acceptedOffersError,
      );
      setCompletedProjectCount(0);
    } else {
      const jobIds = [
        ...new Set(
          (acceptedOffersData ?? [])
            .map((offer) => Number(offer.job_id))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      ];

      if (jobIds.length === 0) {
        setCompletedProjectCount(0);
      } else {
        const { data: completedJobsData, error: completedJobsError } =
          await supabase
            .from("jobs")
            .select("id, status")
            .in("id", jobIds)
            .eq("status", "completed");

        if (completedJobsError) {
          console.error(
            "Provider completed jobs error:",
            completedJobsError,
          );
          setCompletedProjectCount(0);
        } else {
          setCompletedProjectCount(
            (completedJobsData ?? []).length,
          );
        }
      }
    }

    setLoading(false);
  }

  function normalizeWorkSamples(
    rows: WorkSampleRow[],
  ): WorkSample[] {
    return rows.map((item) => {
      const categoryRows = Array.isArray(
        item.work_sample_categories,
      )
        ? item.work_sample_categories
        : item.work_sample_categories
          ? [item.work_sample_categories]
          : [];

      const categories = categoryRows
        .map((row) => {
          const category = Array.isArray(
            row.category,
          )
            ? row.category[0]
            : row.category;

          if (!category) {
            return null;
          }

          return {
            id: category.id,
            name: category.name,
          };
        })
        .filter(
          (
            category,
          ): category is {
            id: number;
            name: string;
          } => category !== null,
        );

      const serviceRows = Array.isArray(
        item.work_sample_services,
      )
        ? item.work_sample_services
        : item.work_sample_services
          ? [item.work_sample_services]
          : [];

      const services = serviceRows
        .map((row) => {
          const service = Array.isArray(
            row.service,
          )
            ? row.service[0]
            : row.service;

          if (!service) {
            return null;
          }

          return {
            id: service.id,
            name: service.name,
          };
        })
        .filter(
          (
            service,
          ): service is {
            id: number;
            name: string;
          } => service !== null,
        );

      return {
        id: item.id,
        title: item.title,
        description: item.description,
        projectUrl: item.project_url,
        createdAt: item.created_at,
        categories,
        services,
      };
    });
  }

  function normalizeUrl(url: string) {
    const trimmed = url.trim();

    if (!trimmed) {
      return "";
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }

  function formatReviewDate(value: string) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function getInitials(
    name: string | null,
  ) {
    if (!name?.trim()) {
      return "U";
    }

    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return (
      parts[0][0] +
      parts[parts.length - 1][0]
    ).toUpperCase();
  }

  function getGroupedServices() {
    const groups = new Map<
      string,
      {
        categoryId: number | null;
        categoryName: string;
        services: ProviderService[];
      }
    >();

    for (const service of services) {
      const categoryName =
        service.category?.name?.trim() ||
        "Diğer";

      const categoryId =
        service.category?.id ?? null;

      const key =
        categoryId !== null
          ? `category-${categoryId}`
          : `category-${categoryName}`;

      if (!groups.has(key)) {
        groups.set(key, {
          categoryId,
          categoryName,
          services: [],
        });
      }

      groups.get(key)!.services.push(
        service,
      );
    }

    return Array.from(
      groups.values(),
    ).sort((a, b) => {
      if (
        a.categoryId === null &&
        b.categoryId !== null
      ) {
        return 1;
      }

      if (
        a.categoryId !== null &&
        b.categoryId === null
      ) {
        return -1;
      }

      return a.categoryName.localeCompare(
        b.categoryName,
        "tr-TR",
      );
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-zinc-500">
            Uzman profili yükleniyor...
          </p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-6 text-sm font-medium text-zinc-500 hover:text-zinc-900"
          >
            ← Geri dön
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm text-red-700">
              {error ||
                "Uzman profili bulunamadı."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const groupedServices =
    getGroupedServices();

  const isOwnProfile =
    currentUserId !== null &&
    currentUserId === profile.user_id;

  const showCustomerActions =
    customerEnabled && !isOwnProfile;

  const aboutText = profile.bio?.trim() ?? "";
  const visibleServiceGroups = groupedServices.filter(
    (group) => group.services.length > 0,
  );

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => router.push("/providers")}
          className="mb-8 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          ← Uzmanlara dön
        </button>

        <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-2xl font-semibold text-white">
            {getInitials(profile.full_name)}
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              {profile.full_name?.trim() ||
                "İsimsiz Uzman"}
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              {profile.experience_years} yıl deneyim
              {profile.city?.trim()
                ? ` · ${profile.city.trim()}`
                : ""}
            </p>

            {reviewSummary ? (
              <button
                type="button"
                onClick={() =>
                  setShowReviews((open) => !open)
                }
                className="mt-1 text-left text-sm text-zinc-500 hover:text-zinc-700"
                aria-expanded={showReviews}
              >
                {`⭐ ${reviewSummary.average} · ${reviewSummary.count} değerlendirme`}
              </button>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">
                Henüz değerlendirme yok
              </p>
            )}

            <p className="mt-1 text-sm text-zinc-500">
              {completedProjectCount > 0
                ? `💼 ${completedProjectCount} proje tamamladı`
                : "💼 Henüz proje tamamlamadı"}
            </p>

            {(profile.can_work_remote ||
              profile.can_work_on_site) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.can_work_remote ? (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    Uzaktan
                  </span>
                ) : null}

                {profile.can_work_on_site ? (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    Yerinde
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </header>

        {showReviews && reviewSummary ? (
          <section className="mt-6 rounded-xl border border-zinc-200 p-4 sm:p-5">
            <h2 className="text-base font-semibold text-zinc-900">
              Değerlendirmeler
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              {`⭐ ${reviewSummary.average} · ${reviewSummary.count} değerlendirme`}
            </p>

            <div className="mt-4 space-y-4">
              {reviews.map((review, index) => {
                const rating = Math.min(
                  5,
                  Math.max(0, Math.round(review.rating)),
                );
                const reviewDate = formatReviewDate(
                  review.created_at,
                );

                return (
                  <article
                    key={`${review.created_at}-${index}`}
                    className="border-t border-zinc-100 pt-4 first:border-t-0 first:pt-0"
                  >
                    <p
                      className="text-sm tracking-wide text-zinc-800"
                      aria-label={`${rating} yıldız`}
                    >
                      {"★★★★★".slice(0, rating)}
                      <span className="text-zinc-300">
                        {"★★★★★".slice(rating)}
                      </span>
                    </p>

                    {review.comment ? (
                      <p className="mt-2 text-sm leading-6 text-zinc-600">
                        {review.comment}
                      </p>
                    ) : null}

                    {reviewDate ? (
                      <p className="mt-2 text-xs text-zinc-400">
                        {reviewDate}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {aboutText ? (
          <section className="mt-10">
            <h2 className="text-base font-semibold text-zinc-900">
              Hakkımda
            </h2>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-600">
              {aboutText}
            </p>
          </section>
        ) : null}

        <section className="mt-10">
          <h2 className="text-base font-semibold text-zinc-900">
            Hizmetler
          </h2>

          {visibleServiceGroups.length > 0 ? (
            <div className="mt-4 space-y-5">
              {visibleServiceGroups.map((group) => (
                <div
                  key={
                    group.categoryId !== null
                      ? `category-${group.categoryId}`
                      : group.categoryName
                  }
                >
                  <h3 className="text-sm font-medium text-zinc-800">
                    {group.categoryName}
                  </h3>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.services.map((service) => (
                      <span
                        key={service.id}
                        className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
                      >
                        {service.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">
              Hizmet bilgisi bulunmuyor.
            </p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold text-zinc-900">
            Çalışmalarım
          </h2>

          {workSamplesError ? (
            <p className="mt-3 text-sm text-zinc-400">
              {workSamplesError}
            </p>
          ) : workSamples.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">
              Henüz portfolyo çalışması eklenmemiş.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {workSamples.map((work) => {
                const projectHref = work.projectUrl
                  ? normalizeUrl(work.projectUrl)
                  : "";

                return (
                  <article
                    key={work.id}
                    className="flex flex-col rounded-xl border border-zinc-200 p-5"
                  >
                    <h3 className="text-sm font-semibold text-zinc-900">
                      {work.title}
                    </h3>

                    {work.description ? (
                      <p className="mt-2 text-sm leading-6 text-zinc-600">
                        {work.description}
                      </p>
                    ) : null}

                    {work.categories.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {work.categories.map((category) => (
                          <span
                            key={`${work.id}-${category.id}`}
                            className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {work.services.length > 0 ? (
                      <div
                        className={`flex flex-wrap gap-2 ${
                          work.categories.length > 0
                            ? "mt-2"
                            : "mt-3"
                        }`}
                      >
                        {work.services.map((service) => (
                          <span
                            key={`${work.id}-service-${service.id}`}
                            className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
                          >
                            {service.name}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {projectHref ? (
                      <a
                        href={projectHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 truncate text-sm font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
                      >
                        Projeyi Gör ↗
                      </a>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {showCustomerActions ? (
          <section className="mt-10 rounded-xl border border-zinc-200 p-5">
            <h2 className="text-base font-semibold text-zinc-900">
              Bu uzmanla çalışmak mı istiyorsun?
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-600">
              İhtiyacını anlatan bir proje oluştur. Uygunluk
              durumuna göre bu uzman sana teklif verebilir.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/jobs/new?provider_id=${encodeURIComponent(profile.user_id)}`,
                )
              }
              className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 sm:w-auto"
            >
              Bu Uzman İçin Proje Oluştur
            </button>
          </section>
        ) : null}
      </div>
    </main>
  );
}