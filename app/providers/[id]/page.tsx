"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { rememberRecentProvider } from "@/components/recent-providers";

type ProviderProfile = {
  user_id: string;
  full_name: string | null;
  bio: string | null;
  experience_years: number;
  city: string | null;
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
  category: WorkSampleCategoryNested | WorkSampleCategoryNested[] | null;
};

type WorkSampleServiceNested = {
  id: number;
  name: string;
};

type WorkSampleServiceRow = {
  service_id: number;
  service: WorkSampleServiceNested | WorkSampleServiceNested[] | null;
};

type WorkSampleRow = {
  id: number;
  title: string;
  description: string | null;
  project_url: string | null;
  created_at: string;
  work_sample_categories: WorkSampleCategoryRow[] | WorkSampleCategoryRow | null;
  work_sample_services: WorkSampleServiceRow[] | WorkSampleServiceRow | null;
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

function getInitials(name: string | null) {
  if (!name?.trim()) {
    return "U";
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getWorkLabel(profile: ProviderProfile) {
  if (profile.can_work_remote && profile.can_work_on_site) {
    return "Hibrit";
  }

  if (profile.can_work_remote) {
    return "Uzaktan";
  }

  if (profile.can_work_on_site) {
    return "Yerinde";
  }

  return null;
}

const INITIAL_VISIBLE_SERVICES = 6;
const INITIAL_SERVICES_PER_CATEGORY = 3;

type ServiceGroup = {
  categoryId: number | null;
  categoryName: string;
  services: ProviderService[];
};

function getGroupedServices(services: ProviderService[]): ServiceGroup[] {
  const groups = new Map<string, ServiceGroup>();

  for (const service of services) {
    const categoryName = service.category?.name?.trim() || "Diğer";
    const categoryId = service.category?.id ?? null;
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

    groups.get(key)!.services.push(service);
  }

  return Array.from(groups.values())
    .filter((group) => group.services.length > 0)
    .sort((a, b) => {
      if (a.categoryId === null && b.categoryId !== null) {
        return 1;
      }

      if (a.categoryId !== null && b.categoryId === null) {
        return -1;
      }

      return a.categoryName.localeCompare(b.categoryName, "tr");
    });
}

function getCollapsedServiceGroups(groups: ServiceGroup[]): ServiceGroup[] {
  let remaining = INITIAL_VISIBLE_SERVICES;
  const collapsed: ServiceGroup[] = [];

  for (const group of groups) {
    if (remaining <= 0) {
      break;
    }

    const take = Math.min(
      INITIAL_SERVICES_PER_CATEGORY,
      remaining,
      group.services.length,
    );

    if (take <= 0) {
      continue;
    }

    collapsed.push({
      ...group,
      services: group.services.slice(0, take),
    });
    remaining -= take;
  }

  return collapsed;
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

export default function ProviderProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  const providerId = typeof params.id === "string" ? params.id : "";

  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [workSamples, setWorkSamples] = useState<WorkSample[]>([]);
  const [workSamplesError, setWorkSamplesError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [customerEnabled, setCustomerEnabled] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
  const [servicesExpanded, setServicesExpanded] = useState(false);

  useEffect(() => {
    if (!providerId) {
      setNotFound(true);
      setError("");
      setLoading(false);
      return;
    }

    void loadProfile();
  }, [providerId]);

  async function loadProfile() {
    setLoading(true);
    setError("");
    setNotFound(false);
    setWorkSamplesError("");
    setReviewSummary(null);
    setReviews([]);
    setShowReviews(false);
    setServicesExpanded(false);

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

      setCustomerEnabled(Boolean(permissionProfile?.customer_enabled));
    } else {
      setCustomerEnabled(false);
    }

    const { data: profileData, error: profileError } =
      await supabase.rpc("discover_providers");

    if (profileError) {
      console.error("discover_providers error:", profileError);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setProfile(null);
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
          String(item.user_id).toLowerCase() === providerId.toLowerCase(),
      ) ?? null;

    if (!providerRow) {
      setNotFound(true);
      setProfile(null);
      setLoading(false);
      return;
    }

    const provider: ProviderProfile = {
      user_id: providerRow.user_id,
      full_name: providerRow.full_name,
      bio: providerRow.bio,
      experience_years: Number(providerRow.experience_years ?? 0),
      city: providerRow.city,
      can_work_remote: Boolean(providerRow.can_work_remote),
      can_work_on_site: Boolean(providerRow.can_work_on_site),
    };

    const { data: servicesData, error: servicesError } = await supabase.rpc(
      "discover_provider_services",
    );

    if (servicesError) {
      console.error("discover_provider_services error:", servicesError);
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

    const normalizedServices = providerServiceRows.map((service) => ({
      id: service.service_id,
      name: service.service_name,
      category: service.category_id
        ? {
            id: service.category_id,
            name: service.category_name ?? "",
          }
        : null,
    }));

    const { data: workSamplesData, error: workSamplesQueryError } =
      await supabase
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
      console.error("Provider work samples error:", workSamplesQueryError);
      setWorkSamplesError("Portfolyo çalışmaları yüklenemedi.");
      setWorkSamples([]);
    } else {
      setWorkSamplesError("");
      setWorkSamples(
        normalizeWorkSamples((workSamplesData ?? []) as WorkSampleRow[]),
      );
    }

    setProfile(provider);
    setServices(normalizedServices);

    const firstImage = (
      Array.isArray(workSamplesData) ? workSamplesData : []
    ).find((sample) => isImageUrl(sample.project_url));

    rememberRecentProvider(
      {
        id: provider.user_id,
        fullName: provider.full_name?.trim() || "İsimsiz Uzman",
        bio: provider.bio?.trim() || null,
        city: provider.city?.trim() || null,
        workLabel: getWorkLabel(provider),
        imageUrl: firstImage?.project_url?.trim() || null,
      },
      user?.id ?? null,
    );

    const { data: reviewsData, error: reviewsError } = await supabase
      .from("reviews")
      .select("rating, comment, created_at")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });

    if (reviewsError) {
      console.error("Provider reviews error:", reviewsError);
      setReviewSummary(null);
      setReviews([]);
    } else {
      const normalizedReviews = (reviewsData ?? []).map((row) => ({
        rating: Number(row.rating),
        comment:
          typeof row.comment === "string" && row.comment.trim()
            ? row.comment.trim()
            : null,
        created_at: String(row.created_at ?? ""),
      }));

      const ratings = normalizedReviews
        .map((row) => row.rating)
        .filter((rating) => Number.isFinite(rating));

      setReviews(normalizedReviews);

      if (ratings.length === 0) {
        setReviewSummary(null);
      } else {
        const total = ratings.reduce((sum, rating) => sum + rating, 0);
        const average = total / ratings.length;

        setReviewSummary({
          average: (Math.round(average * 10) / 10).toFixed(1),
          count: ratings.length,
        });
      }
    }

    setLoading(false);
  }

  function normalizeWorkSamples(rows: WorkSampleRow[]): WorkSample[] {
    return rows.map((item) => {
      const categoryRows = Array.isArray(item.work_sample_categories)
        ? item.work_sample_categories
        : item.work_sample_categories
          ? [item.work_sample_categories]
          : [];

      const categories = categoryRows
        .map((row) => {
          const category = Array.isArray(row.category)
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
          (category): category is { id: number; name: string } =>
            category !== null,
        );

      const serviceRows = Array.isArray(item.work_sample_services)
        ? item.work_sample_services
        : item.work_sample_services
          ? [item.work_sample_services]
          : [];

      const servicesForSample = serviceRows
        .map((row) => {
          const service = Array.isArray(row.service)
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
          (service): service is { id: number; name: string } =>
            service !== null,
        );

      return {
        id: item.id,
        title: item.title,
        description: item.description,
        projectUrl: item.project_url,
        createdAt: item.created_at,
        categories,
        services: servicesForSample,
      };
    });
  }

  function handleWorkCta() {
    if (!profile) {
      return;
    }

    const isOwnProfile =
      currentUserId !== null && currentUserId === profile.user_id;

    if (customerEnabled && !isOwnProfile) {
      router.push(
        `/jobs/new?provider_id=${encodeURIComponent(profile.user_id)}`,
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <section className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-sm text-zinc-500">Uzman profili yükleniyor...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen">
        <section className="mx-auto max-w-6xl px-6 py-12">
          <Link
            href="/providers"
            className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
          >
            ← Uzmanları Keşfet
          </Link>

          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </section>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="min-h-screen">
        <section className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Uzman bulunamadı.
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Bu profil keşfedilebilir uzmanlar arasında yer almıyor olabilir.
          </p>
          <Link
            href="/providers"
            className="mt-6 inline-flex rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Uzmanları Keşfet
          </Link>
        </section>
      </main>
    );
  }

  const fullName = profile.full_name?.trim() || "İsimsiz Uzman";
  const bio = profile.bio?.trim() || "";
  const city = profile.city?.trim() || "";
  const workLabel = getWorkLabel(profile);
  const metaItems = [
    city || null,
    workLabel,
    profile.experience_years > 0
      ? `${profile.experience_years} yıl deneyim`
      : null,
  ].filter(Boolean);

  const serviceGroups = getGroupedServices(services);
  const collapsedServiceGroups = getCollapsedServiceGroups(serviceGroups);
  const visibleServiceGroups = servicesExpanded
    ? serviceGroups
    : collapsedServiceGroups;
  const hiddenServiceCount =
    services.length -
    collapsedServiceGroups.reduce(
      (count, group) => count + group.services.length,
      0,
    );

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-6xl px-6 py-12">
        <Link
          href="/providers"
          className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          ← Uzmanları Keşfet
        </Link>

        <header className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg font-semibold text-zinc-700">
            {getInitials(fullName)}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
              {fullName}
            </h1>

            {reviewSummary ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowReviews((open) => !open)}
                  className="text-sm font-medium text-zinc-800"
                  aria-expanded={showReviews}
                >
                  <span className="tabular-nums">{reviewSummary.average}</span>
                  <span className="font-normal text-zinc-500">
                    {` · ${reviewSummary.count} değerlendirme`}
                  </span>
                </button>

                {showReviews ? (
                  <div className="mt-3 max-w-2xl space-y-4">
                    {reviews.map((review, index) => {
                      const rating = Math.min(
                        5,
                        Math.max(0, Math.round(review.rating)),
                      );

                      return (
                        <article
                          key={`${review.created_at}-${index}`}
                          className="border-t border-zinc-100 pt-3"
                        >
                          <p
                            className="text-sm text-zinc-800"
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
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            {metaItems.length > 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                {metaItems.join(" · ")}
              </p>
            ) : null}

            {bio ? (
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600">
                {bio}
              </p>
            ) : (
              <p className="mt-4 text-sm text-zinc-400">Henüz bio eklenmemiş.</p>
            )}
          </div>
        </header>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
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
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {group.categoryName}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.services.map((service) => (
                      <span
                        key={service.id}
                        className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700"
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

          {hiddenServiceCount > 0 ? (
            <button
              type="button"
              onClick={() => setServicesExpanded((open) => !open)}
              className="mt-4 text-sm font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950"
            >
              {servicesExpanded
                ? "Daha az göster"
                : `+${hiddenServiceCount} hizmet daha`}
            </button>
          ) : null}
        </section>

        <div className="mt-8">
          <button
            type="button"
            onClick={handleWorkCta}
            className="w-full rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 sm:w-auto"
          >
            Bu uzmanla çalışmak istiyorum
          </button>
        </div>

        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
            Portföy
          </h2>

          {workSamplesError ? (
            <p className="mt-4 text-sm text-zinc-500">{workSamplesError}</p>
          ) : workSamples.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              Bu uzman henüz portföy çalışması eklemedi.
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workSamples.map((work) => {
                const title = work.title?.trim() || "Çalışma";
                const imageUrl = isImageUrl(work.projectUrl)
                  ? work.projectUrl
                  : null;
                const projectHref =
                  work.projectUrl && !imageUrl
                    ? normalizeUrl(work.projectUrl)
                    : "";

                if (imageUrl) {
                  return (
                    <article
                      key={work.id}
                      className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white"
                    >
                      <div className="relative aspect-[4/3] bg-zinc-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt={title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="p-4">
                        <h3 className="truncate text-sm font-semibold text-zinc-900">
                          {title}
                        </h3>
                      </div>
                    </article>
                  );
                }

                return (
                  <article
                    key={work.id}
                    className="flex aspect-[4/3] flex-col justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900">
                        {title}
                      </h3>
                      {work.description?.trim() ? (
                        <p className="mt-2 line-clamp-4 text-sm leading-6 text-zinc-600">
                          {work.description.trim()}
                        </p>
                      ) : null}
                    </div>

                    {projectHref ? (
                      <a
                        href={projectHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 text-sm font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
                      >
                        Çalışmayı gör
                      </a>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
