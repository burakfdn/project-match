"use client";

import { useEffect, useState } from "react";

import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { ProviderPublicProfileView } from "@/components/provider-public-profile";

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
      setError("Bu içeriğe şu an erişilemiyor.");
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

      setError("Bir hata oluştu. Lütfen tekrar deneyin.");

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
      setError("Bu içeriğe şu an erişilemiyor.");

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

    const {
      data: completedCountData,
      error: completedCountError,
    } = await supabase.rpc(
      "get_provider_completed_project_count",
      {
        p_provider_id: providerId,
      },
    );

    if (completedCountError) {
      console.error(
        "Provider completed projects error:",
        completedCountError,
      );
      setCompletedProjectCount(0);
    } else {
      const completedCount = Number(completedCountData);

      setCompletedProjectCount(
        Number.isFinite(completedCount) && completedCount > 0
          ? completedCount
          : 0,
      );
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
                "Bu içeriğe şu an erişilemiyor."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const isOwnProfile =
    currentUserId !== null &&
    currentUserId === profile.user_id;

  const showCustomerActions =
    customerEnabled && !isOwnProfile;

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <ProviderPublicProfileView
          profile={profile}
          services={services}
          workSamples={workSamples}
          workSamplesError={workSamplesError}
          reviewSummary={reviewSummary}
          reviews={reviews}
          showReviews={showReviews}
          onToggleReviews={() =>
            setShowReviews((open) => !open)
          }
          completedProjectCount={completedProjectCount}
          backLink={
            <button
              type="button"
              onClick={() => router.push("/providers")}
              className="mb-8 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
            >
              ← Uzmanlara dön
            </button>
          }
          headerActions={
            showCustomerActions ? (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/jobs/new?provider_id=${encodeURIComponent(profile.user_id)}`,
                  )
                }
                className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 sm:w-auto"
              >
                Bu Uzman İçin Proje Oluştur
              </button>
            ) : null
          }
          footer={
            showCustomerActions ? (
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
            ) : null
          }
        />
      </div>
    </main>
  );
}

