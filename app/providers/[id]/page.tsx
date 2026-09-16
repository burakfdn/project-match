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

    const {
      data: profileData,
      error: profileError,
    } = await supabase.rpc(
      "customer_get_provider_profiles",
      {
        p_provider_ids: [providerId],
      },
    );

    if (profileError) {
      console.error(
        "Provider profile error:",
        profileError,
      );

      setError(
        "Uzman profili yüklenirken bir hata oluştu.",
      );

      setLoading(false);
      return;
    }

    const profiles =
      (profileData ?? []) as ProviderProfile[];

    const provider =
      profiles.find(
        (item) =>
          item.user_id === providerId,
      ) ?? null;

    if (!provider) {
      setError(
        "Bu uzmanın profili görüntülenemiyor.",
      );

      setLoading(false);
      return;
    }

    const {
      data: servicesData,
      error: servicesError,
    } = await supabase.rpc(
      "customer_get_provider_services",
      {
        p_provider_ids: [providerId],
      },
    );

    if (servicesError) {
      console.error(
        "Provider services error:",
        servicesError,
      );
    }

    const serviceRows =
      (servicesData ?? []) as ProviderServiceRow[];

    const normalizedServices =
      serviceRows.map((service) => ({
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

      return {
        id: item.id,
        title: item.title,
        description: item.description,
        projectUrl: item.project_url,
        createdAt: item.created_at,
        categories,
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

  function getWorkLabel() {
    if (!profile) {
      return "-";
    }

    if (
      profile.can_work_remote &&
      profile.can_work_on_site
    ) {
      return "Uzaktan + Yerinde";
    }

    if (profile.can_work_remote) {
      return "Uzaktan";
    }

    if (profile.can_work_on_site) {
      return "Yerinde";
    }

    return "-";
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

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-8 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          ← Tekliflere dön
        </button>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-8 sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-2xl font-semibold text-white">
                {getInitials(
                  profile.full_name,
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-zinc-500">
                  Uzman Profili
                </p>

                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">
                  {profile.full_name?.trim() ||
                    "İsimsiz Uzman"}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-500">
                  <span>
                    {profile.experience_years}{" "}
                    yıl deneyim
                  </span>

                  {profile.city && (
                    <>
                      <span className="text-zinc-300">
                        •
                      </span>

                      <span>
                        {profile.city}
                      </span>
                    </>
                  )}

                  <span className="text-zinc-300">
                    •
                  </span>

                  <span>
                    {getWorkLabel()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1fr_280px]">
            <div>
              {profile.bio && (
                <section>
                  <h2 className="text-base font-semibold text-zinc-900">
                    Hakkında
                  </h2>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-600">
                    {profile.bio}
                  </p>
                </section>
              )}

              <section
                className={
                  profile.bio
                    ? "mt-8"
                    : ""
                }
              >
                <h2 className="text-base font-semibold text-zinc-900">
                  Hizmetler
                </h2>

                {services.length > 0 ? (
                  <div className="mt-5 space-y-6">
                    {groupedServices.map(
                      (group) => (
                        <div
                          key={
                            group.categoryId !==
                            null
                              ? `category-${group.categoryId}`
                              : group.categoryName
                          }
                        >
                          <h3 className="text-sm font-semibold text-zinc-800">
                            {group.categoryName}
                          </h3>

                          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
                            {group.services.map(
                              (service) => (
                                <span
                                  key={
                                    service.id
                                  }
                                  className="inline-flex shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700"
                                >
                                  {service.name}
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-400">
                    Hizmet bilgisi bulunmuyor.
                  </p>
                )}
              </section>

              <section className="mt-8">
                <h2 className="text-base font-semibold text-zinc-900">
                  Portfolyo
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
                    {workSamples.map(
                      (work) => {
                        const projectHref =
                          work.projectUrl
                            ? normalizeUrl(
                                work.projectUrl,
                              )
                            : "";

                        return (
                          <article
                            key={work.id}
                            className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-50 p-5"
                          >
                            <h3 className="text-sm font-semibold text-zinc-900">
                              {work.title}
                            </h3>

                            {work.description && (
                              <p className="mt-2 text-sm leading-6 text-zinc-600">
                                {work.description}
                              </p>
                            )}

                            {work.categories
                              .length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {work.categories.map(
                                  (
                                    category,
                                  ) => (
                                    <span
                                      key={`${work.id}-${category.id}`}
                                      className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
                                    >
                                      {
                                        category.name
                                      }
                                    </span>
                                  ),
                                )}
                              </div>
                            )}

                            {projectHref && (
                              <a
                                href={
                                  projectHref
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 truncate text-sm font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
                              >
                                Projeyi Gör
                              </a>
                            )}
                          </article>
                        );
                      },
                    )}
                  </div>
                )}
              </section>
            </div>

            <aside>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Profil Özeti
                </h2>

                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs text-zinc-400">
                      Deneyim
                    </p>

                    <p className="mt-1 text-sm font-medium text-zinc-800">
                      {profile.experience_years}{" "}
                      yıl
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-400">
                      Şehir
                    </p>

                    <p className="mt-1 text-sm font-medium text-zinc-800">
                      {profile.city ||
                        "Belirtilmemiş"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-400">
                      Çalışma şekli
                    </p>

                    <p className="mt-1 text-sm font-medium text-zinc-800">
                      {getWorkLabel()}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-400">
                      Hizmet sayısı
                    </p>

                    <p className="mt-1 text-sm font-medium text-zinc-800">
                      {services.length}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}