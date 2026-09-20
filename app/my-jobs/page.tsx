"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  getPreviewUser,
  type PreviewUser,
} from "@/lib/preview";
import { createClient } from "@/lib/supabase/client";
import { getJobPublicIdMap } from "@/lib/jobs/public-id";
import { openMessagesDockConversation } from "@/components/MessagesDock";
import { ProjectTimeline } from "@/components/ProjectTimeline";

type Job = {
  id: number;
  public_id?: string | null;
  customer_id: string;
  title: string;
  description: string;
  budget: number | null;
  city: string | null;
  location_type: "remote" | "on_site" | "hybrid";
  status:
    | "open"
    | "closed"
    | "in_progress"
    | "completed"
    | "cancelled";
  created_at: string;
  target_provider_id: string | null;
  service: {
    id: number;
    name: string;
    category: {
      id: number;
      name: string;
    } | null;
  } | null;
};

type ProviderService = {
  id: number;
  name: string;
  category: {
    id: number;
    name: string;
  } | null;
};

type Provider = {
  user_id: string;
  full_name: string | null;
  bio: string | null;
  experience_years: number;
  city: string | null;
  location_type: "remote" | "on_site" | "hybrid";
  can_work_remote: boolean;
  can_work_on_site: boolean;
  services: ProviderService[];
  reviewAverage: string | null;
  reviewCount: number;
};

type Offer = {
  id: number;
  job_id: number;
  provider_id: string;
  price: number;
  message: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  provider: Provider | null;
};

type SortOption =
  | "newest"
  | "price_low"
  | "price_high"
  | "experience_high";

type FilterOption =
  | "all"
  | "pending"
  | "accepted"
  | "rejected";

type OffersByJob = Record<number, Offer[]>;

type PreviewJobRow = {
  job_id: number;
  customer_id: string;
  job_title: string;
  job_description: string;
  job_budget: number | null;
  job_city: string | null;
  job_location_type:
    | "remote"
    | "on_site"
    | "hybrid";
  job_deadline: string | null;
  job_status:
    | "open"
    | "closed"
    | "in_progress"
    | "completed"
    | "cancelled";
  job_created_at: string;

  service_id: number | null;
  service_name: string | null;
  category_id: number | null;
  category_name: string | null;

  offer_id: number | null;
  offer_provider_id: string | null;
  offer_price: number | null;
  offer_message: string | null;
  offer_status:
    | "pending"
    | "accepted"
    | "rejected"
    | null;
  offer_created_at: string | null;

  provider_bio: string | null;
  provider_experience_years: number | null;
  provider_city: string | null;
  provider_location_type:
    | "remote"
    | "on_site"
    | "hybrid"
    | null;
  provider_can_work_remote: boolean | null;
  provider_can_work_on_site: boolean | null;
};

type ProviderProfileRow = {
  user_id: string;
  full_name: string | null;
  bio: string | null;
  experience_years: number;
  city: string | null;
  location_type: "remote" | "on_site" | "hybrid";
  can_work_remote: boolean;
  can_work_on_site: boolean;
};

type ProviderServiceRow = {
  provider_id: string;
  service_id: number;
  service_name: string;
  category_id: number | null;
  category_name: string | null;
};

type AdminPreviewProviderProfileRow = {
  id: string;
  full_name: string | null;
  bio: string | null;
  experience_years: number | null;
  city: string | null;
  can_work_remote: boolean | null;
  can_work_on_site: boolean | null;
};

type AdminPreviewProviderServiceRow = {
  service_id: number;
  service_name: string;
  category_id: number | null;
  category_name: string | null;
};

function summarizeProviderReviews(
  rows: Array<{
    provider_id?: string | null;
    rating?: number | null;
  }>,
) {
  const ratingsByProvider: Record<string, number[]> = {};

  for (const row of rows) {
    const providerId = row.provider_id;
    const rating = Number(row.rating);

    if (!providerId || !Number.isFinite(rating)) {
      continue;
    }

    if (!ratingsByProvider[providerId]) {
      ratingsByProvider[providerId] = [];
    }

    ratingsByProvider[providerId].push(rating);
  }

  const summaries: Record<
    string,
    { average: string; count: number }
  > = {};

  for (const [providerId, ratings] of Object.entries(
    ratingsByProvider,
  )) {
    const total = ratings.reduce(
      (sum, value) => sum + value,
      0,
    );

    summaries[providerId] = {
      average: (
        Math.round((total / ratings.length) * 10) / 10
      ).toFixed(1),
      count: ratings.length,
    };
  }

  return summaries;
}

function getReviewSummaryLabel(
  average: string | null | undefined,
  count: number | undefined,
) {
  if (!count) {
    return "Henüz değerlendirme yok";
  }

  return `★ ${average} · ${count} değerlendirme`;
}

export default function MyJobsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [offersByJob, setOffersByJob] =
    useState<OffersByJob>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewUser, setPreviewUser] =
    useState<PreviewUser | null>(null);

  const [offerFilter, setOfferFilter] =
    useState<FilterOption>("all");

  const [offerSort, setOfferSort] =
    useState<SortOption>("newest");

  const [jobSearch, setJobSearch] =
    useState("");

  const [jobStatusFilter, setJobStatusFilter] =
    useState<"all" | Job["status"]>("all");

  const [processingOfferId, setProcessingOfferId] =
    useState<number | null>(null);

  const [selectedOffers, setSelectedOffers] =
    useState<number[]>([]);

  const [comparisonJobId, setComparisonJobId] =
    useState<number | null>(null);

  const [reviewedJobIds, setReviewedJobIds] =
    useState<Record<number, true>>({});
  const [showPublishedNotice, setShowPublishedNotice] =
    useState(false);
  const [providerNamesById, setProviderNamesById] =
    useState<Record<string, string>>({});

  useEffect(() => {
    const currentPreviewUser =
      getPreviewUser();

    setPreviewUser(currentPreviewUser);
    loadData(currentPreviewUser);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("published") !== "1") {
      return;
    }

    setShowPublishedNotice(true);
    router.replace("/my-jobs");
  }, [router]);

  async function loadData(
    currentPreviewUser: PreviewUser | null = previewUser,
  ) {
    setLoading(true);
    setError("");

    if (currentPreviewUser) {
      await loadPreviewData(currentPreviewUser);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Oturum bilgisi alınamadı.");
      setLoading(false);
      return;
    }

    await loadRealData(user.id);
  }

  async function loadReviewedJobIds(jobsList: Job[]) {
    const completedIds = jobsList
      .filter((job) => job.status === "completed")
      .map((job) => job.id);

    if (completedIds.length === 0) {
      setReviewedJobIds({});
      return;
    }

    const { data: jobReviews, error: jobReviewsError } =
      await supabase
        .from("reviews")
        .select("job_id")
        .in("job_id", completedIds);

    if (jobReviewsError) {
      console.error("Job reviews error:", jobReviewsError);
      setReviewedJobIds({});
      return;
    }

    const nextReviewed: Record<number, true> = {};

    for (const row of jobReviews ?? []) {
      nextReviewed[Number(row.job_id)] = true;
    }

    setReviewedJobIds(nextReviewed);
  }

  async function loadPreviewData(
    selectedUser: PreviewUser,
  ) {
    const {
      data,
      error: previewError,
    } = await supabase.rpc(
      "admin_preview_customer_jobs",
      {
        p_user_id: selectedUser.id,
      },
    );

    if (previewError) {
      console.error(
        "Preview jobs error:",
        previewError,
      );

      setError(
        "İlanlar ve teklifler yüklenirken bir hata oluştu.",
      );

      setLoading(false);
      return;
    }

    const rows = (data ??
      []) as PreviewJobRow[];

    /*
     * Admin preview'da admin_preview_customer_jobs
     * provider ID'sini veriyor ancak provider adını
     * vermiyor.
     *
     * Bu yüzden ilgili provider ID'lerini topluyor,
     * mevcut admin preview RPC'lerinden profil ve
     * hizmet bilgilerini ayrıca çekiyoruz.
     */
    const providerIds = [
      ...new Set(
        rows
          .map(
            (row) =>
              row.offer_provider_id,
          )
          .filter(
            (
              providerId,
            ): providerId is string =>
              Boolean(providerId),
          ),
      ),
    ];

    const previewProviderProfilesMap: Record<
      string,
      AdminPreviewProviderProfileRow
    > = {};

    const previewProviderServicesMap: Record<
      string,
      ProviderService[]
    > = {};

    if (providerIds.length > 0) {
      const profileResults =
        await Promise.all(
          providerIds.map(
            async (providerId) => {
              const { data, error } =
                await supabase.rpc(
                  "admin_preview_provider_profile",
                  {
                    p_user_id:
                      providerId,
                  },
                );

              if (error) {
                console.error(
                  "Admin preview provider profile error:",
                  providerId,
                  error,
                );

                return null;
              }

              const profile =
                (
                  data ?? []
                )[0] as
                  | AdminPreviewProviderProfileRow
                  | undefined;

              if (profile) {
                previewProviderProfilesMap[
                  providerId
                ] = profile;
              }

              return profile ?? null;
            },
          ),
        );

      await Promise.all(
        providerIds.map(
          async (providerId) => {
            const { data, error } =
              await supabase.rpc(
                "admin_preview_provider_services",
                {
                  p_user_id:
                    providerId,
                },
              );

            if (error) {
              console.error(
                "Admin preview provider services error:",
                providerId,
                error,
              );

              return;
            }

            const serviceRows =
              (data ??
                []) as AdminPreviewProviderServiceRow[];

            previewProviderServicesMap[
              providerId
            ] = serviceRows.map(
              (service) => ({
                id: service.service_id,
                name:
                  service.service_name,
                category:
                  service.category_id
                    ? {
                        id:
                          service.category_id,
                        name:
                          service.category_name ??
                          "",
                      }
                    : null,
              }),
            );
          },
        ),
      );

      void profileResults;
    }

    let reviewSummaries: Record<
      string,
      { average: string; count: number }
    > = {};

    if (providerIds.length > 0) {
      const { data: reviewsData, error: reviewsError } =
        await supabase
          .from("reviews")
          .select("provider_id, rating")
          .in("provider_id", providerIds);

      if (reviewsError) {
        console.error(
          "Provider reviews error:",
          reviewsError,
        );
      } else {
        reviewSummaries = summarizeProviderReviews(
          reviewsData ?? [],
        );
      }
    }

    const jobsMap = new Map<
      number,
      Job
    >();

    const groupedOffers: OffersByJob =
      {};

    for (const row of rows) {
      if (!jobsMap.has(row.job_id)) {
        jobsMap.set(row.job_id, {
          id: row.job_id,
          customer_id:
            row.customer_id,
          title: row.job_title,
          description:
            row.job_description,
          budget:
            row.job_budget,
          city: row.job_city,
          location_type:
            row.job_location_type,
          status:
            row.job_status,
          created_at:
            row.job_created_at,
          target_provider_id: null,

          service:
            row.service_id
              ? {
                  id:
                    row.service_id,
                  name:
                    row.service_name ??
                    "",
                  category:
                    row.category_id
                      ? {
                          id:
                            row.category_id,
                          name:
                            row.category_name ??
                            "",
                        }
                      : null,
                }
              : null,
        });
      }

      if (
        row.offer_id !== null &&
        row.offer_provider_id &&
        row.offer_status
      ) {
        if (
          !groupedOffers[
            row.job_id
          ]
        ) {
          groupedOffers[
            row.job_id
          ] = [];
        }

        const previewProfile =
          previewProviderProfilesMap[
            row.offer_provider_id
          ];

        const previewServices =
          previewProviderServicesMap[
            row.offer_provider_id
          ] ?? [];

        const canWorkRemote =
          previewProfile
            ?.can_work_remote ??
          row.provider_can_work_remote ??
          false;

        const canWorkOnSite =
          previewProfile
            ?.can_work_on_site ??
          row.provider_can_work_on_site ??
          false;

        let locationType:
          | "remote"
          | "on_site"
          | "hybrid" =
          row.provider_location_type ??
          "remote";

        if (
          canWorkRemote &&
          canWorkOnSite
        ) {
          locationType =
            "hybrid";
        } else if (
          canWorkOnSite
        ) {
          locationType =
            "on_site";
        } else {
          locationType =
            "remote";
        }

        groupedOffers[
          row.job_id
        ].push({
          id: row.offer_id,
          job_id: row.job_id,
          provider_id:
            row.offer_provider_id,

          price: Number(
            row.offer_price ?? 0,
          ),

          message:
            row.offer_message,

          status:
            row.offer_status,

          created_at:
            row.offer_created_at ??
            row.job_created_at,

          provider: {
            user_id:
              row.offer_provider_id,

            full_name:
              previewProfile?.full_name ??
              null,

            bio:
              previewProfile?.bio ??
              row.provider_bio,

            experience_years:
              Number(
                previewProfile?.experience_years ??
                  row.provider_experience_years ??
                  0,
              ),

            city:
              previewProfile?.city ??
              row.provider_city,

            location_type:
              locationType,

            can_work_remote:
              canWorkRemote,

            can_work_on_site:
              canWorkOnSite,

            services:
              previewServices,

            reviewAverage:
              reviewSummaries[
                row.offer_provider_id
              ]?.average ?? null,

            reviewCount:
              reviewSummaries[
                row.offer_provider_id
              ]?.count ?? 0,
          },
        });
      }
    }

    const previewJobs = Array.from(jobsMap.values());
    const publicIds = await getJobPublicIdMap(
      supabase,
      previewJobs.map((job) => job.id),
    );

    setJobs(
      previewJobs.map((job) => ({
        ...job,
        public_id: publicIds.get(job.id) ?? null,
      })),
    );

    setOffersByJob(
      groupedOffers,
    );

    await loadReviewedJobIds(
      Array.from(jobsMap.values()),
    );

    setLoading(false);
  }

  async function loadRealData(
    userId: string,
  ) {
    const {
      data: jobsData,
      error: jobsError,
    } = await supabase
      .from("jobs")
      .select(
        `
        id,
        public_id,
        customer_id,
        title,
        description,
        budget,
        city,
        location_type,
        status,
        created_at,
        target_provider_id,
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
      .eq(
        "customer_id",
        userId,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      );

    if (jobsError) {
      console.error(
        "Jobs error:",
        jobsError,
      );

      setError(
        "İlanlar yüklenirken bir hata oluştu.",
      );

      setLoading(false);
      return;
    }

    const normalizedJobs =
      (jobsData ?? []).map(
        (job: any) => ({
          ...job,

          service:
            Array.isArray(
              job.service,
            )
              ? job.service[0] ??
                null
              : job.service ??
                null,
        }),
      ) as Job[];

    setJobs(
      normalizedJobs,
    );

    if (
      normalizedJobs.length ===
      0
    ) {
      setOffersByJob({});
      setReviewedJobIds({});
      setProviderNamesById({});
      setLoading(false);
      return;
    }

    const jobIds =
      normalizedJobs.map(
        (job) => job.id,
      );

    const {
      data: offersData,
      error: offersError,
    } = await supabase
      .from("offers")
      .select(
        `
        id,
        job_id,
        provider_id,
        price,
        message,
        status,
        created_at
      `,
      )
      .in(
        "job_id",
        jobIds,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      );

    if (offersError) {
      console.error(
        "Offers error:",
        offersError,
      );

      setError(
        "Teklifler yüklenirken bir hata oluştu.",
      );

      setLoading(false);
      return;
    }

    const providerIds = [
      ...new Set(
        [
          ...(offersData ?? []).map(
            (offer) =>
              offer.provider_id,
          ),
          ...normalizedJobs
            .map((job) => job.target_provider_id)
            .filter((id): id is string => Boolean(id)),
        ],
      ),
    ];

    let providersMap: Record<
      string,
      Provider
    > = {};

    if (
      providerIds.length > 0
    ) {
      const [
        providerProfilesResult,
        providerServicesResult,
        providerReviewsResult,
      ] = await Promise.all([
        supabase.rpc(
          "customer_get_provider_profiles",
          {
            p_provider_ids:
              providerIds,
          },
        ),

        supabase.rpc(
          "customer_get_provider_services",
          {
            p_provider_ids:
              providerIds,
          },
        ),

        supabase
          .from("reviews")
          .select("provider_id, rating")
          .in("provider_id", providerIds),
      ]);

      if (
        providerProfilesResult.error
      ) {
        console.error(
          "Provider profiles error:",
          providerProfilesResult.error,
        );
      }

      if (
        providerServicesResult.error
      ) {
        console.error(
          "Provider services error:",
          providerServicesResult.error,
        );
      }

      if (providerReviewsResult.error) {
        console.error(
          "Provider reviews error:",
          providerReviewsResult.error,
        );
      }

      const reviewSummaries = summarizeProviderReviews(
        (providerReviewsResult.data ?? []) as Array<{
          provider_id?: string | null;
          rating?: number | null;
        }>,
      );

      const providerProfiles =
        (providerProfilesResult.data ??
          []) as ProviderProfileRow[];

      const providerServices =
        (providerServicesResult.data ??
          []) as ProviderServiceRow[];

      const servicesMap: Record<
        string,
        ProviderService[]
      > = {};

      for (const service of providerServices) {
        if (
          !servicesMap[
            service.provider_id
          ]
        ) {
          servicesMap[
            service.provider_id
          ] = [];
        }

        servicesMap[
          service.provider_id
        ].push({
          id:
            service.service_id,
          name:
            service.service_name,
          category:
            service.category_id
              ? {
                  id:
                    service.category_id,
                  name:
                    service.category_name ??
                    "",
                }
              : null,
        });
      }

      providersMap =
        Object.fromEntries(
          providerProfiles.map(
            (provider) => [
              provider.user_id,
              {
                ...provider,
                services:
                  servicesMap[
                    provider.user_id
                  ] ?? [],
                reviewAverage:
                  reviewSummaries[
                    provider.user_id
                  ]?.average ?? null,
                reviewCount:
                  reviewSummaries[
                    provider.user_id
                  ]?.count ?? 0,
              },
            ],
          ),
        );
    }

    const nextProviderNames: Record<string, string> = {};

    for (const [providerId, provider] of Object.entries(
      providersMap,
    )) {
      const fullName = provider.full_name?.trim();

      if (fullName) {
        nextProviderNames[providerId] = fullName;
      }
    }

    setProviderNamesById(nextProviderNames);

    const groupedOffers: OffersByJob =
      {};

    for (const offer of offersData ??
      []) {
      const normalizedOffer: Offer =
        {
          ...offer,

          price: Number(
            offer.price,
          ),

          provider:
            providersMap[
              offer.provider_id
            ] ?? null,
        };

      if (
        !groupedOffers[
          offer.job_id
        ]
      ) {
        groupedOffers[
          offer.job_id
        ] = [];
      }

      groupedOffers[
        offer.job_id
      ].push(
        normalizedOffer,
      );
    }

    setOffersByJob(
      groupedOffers,
    );

    await loadReviewedJobIds(normalizedJobs);

    setLoading(false);
  }

  function getSortedOffers(
    offers: Offer[],
  ): Offer[] {
    const filteredOffers =
      offers.filter(
        (offer) => {
          if (
            offerFilter ===
            "all"
          ) {
            return true;
          }

          return (
            offer.status ===
            offerFilter
          );
        },
      );

    const sortedOffers = [
      ...filteredOffers,
    ];

    switch (offerSort) {
      case "price_low":
        sortedOffers.sort(
          (a, b) =>
            Number(a.price) -
            Number(b.price),
        );
        break;

      case "price_high":
        sortedOffers.sort(
          (a, b) =>
            Number(b.price) -
            Number(a.price),
        );
        break;

      case "experience_high":
        sortedOffers.sort(
          (a, b) =>
            Number(
              b.provider
                ?.experience_years ??
                0,
            ) -
            Number(
              a.provider
                ?.experience_years ??
                0,
            ),
        );
        break;

      case "newest":
      default:
        sortedOffers.sort(
          (a, b) =>
            new Date(
              b.created_at,
            ).getTime() -
            new Date(
              a.created_at,
            ).getTime(),
        );
        break;
    }

    return sortedOffers;
  }

  function formatPrice(
    price: number,
  ) {
    return new Intl.NumberFormat(
      "tr-TR",
      {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0,
      },
    ).format(price);
  }

  function formatDate(
    date: string | null,
  ) {
    if (!date) {
      return "-";
    }

    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    ).format(
      new Date(date),
    );
  }

  function getLocationLabel(
    locationType: Job["location_type"],
  ) {
    if (
      locationType ===
      "remote"
    ) {
      return "Uzaktan";
    }

    if (
      locationType ===
      "on_site"
    ) {
      return "Yerinde";
    }

    return "Hibrit";
  }

  function getProviderWorkLabel(
    provider: Provider,
  ) {
    if (
      provider.can_work_remote &&
      provider.can_work_on_site
    ) {
      return "Uzaktan + Yerinde";
    }

    if (
      provider.can_work_remote
    ) {
      return "Uzaktan";
    }

    if (
      provider.can_work_on_site
    ) {
      return "Yerinde";
    }

    return "-";
  }

  function getMatchingProviderService(
    job: Job,
    provider: Provider | null,
  ) {
    if (
      !provider ||
      !job.service
    ) {
      return null;
    }

    return (
      provider.services.find(
        (service) =>
          service.id ===
          job.service?.id,
      ) ?? null
    );
  }

  function getStatusLabel(
    status: Job["status"],
  ) {
    switch (status) {
      case "open":
        return "Açık";

      case "closed":
        return "Kapalı";

      case "in_progress":
        return "Devam ediyor";

      case "completed":
        return "Tamamlandı";

      case "cancelled":
        return "İptal edildi";

      default:
        return status;
    }
  }

  function getStatusClass(
    status: Job["status"],
  ) {
    switch (status) {
      case "open":
        return "bg-emerald-50 text-emerald-700";

      case "in_progress":
        return "bg-blue-50 text-blue-700";

      case "completed":
        return "bg-zinc-100 text-zinc-600";

      case "cancelled":
        return "bg-red-50 text-red-700";

      case "closed":
      default:
        return "bg-zinc-100 text-zinc-600";
    }
  }

  async function handleAcceptOffer(
    offerId: number,
  ) {
    if (previewUser) {
      return;
    }

    setProcessingOfferId(
      offerId,
    );

    setError("");

    const { error } =
      await supabase.rpc(
        "accept_offer",
        {
          p_offer_id:
            offerId,
        },
      );

    if (error) {
      console.error(
        "Accept offer error:",
        error,
      );

      setError("Bir hata oluştu. Lütfen tekrar deneyin.");

      setProcessingOfferId(
        null,
      );

      return;
    }

    await loadData();

    setProcessingOfferId(
      null,
    );
  }

  async function handleRejectOffer(
    offerId: number,
  ) {
    if (previewUser) {
      return;
    }

    setProcessingOfferId(
      offerId,
    );

    setError("");

    const { error } =
      await supabase.rpc(
        "reject_offer",
        {
          p_offer_id:
            offerId,
        },
      );

    if (error) {
      console.error(
        "Reject offer error:",
        error,
      );

      setError("Bir hata oluştu. Lütfen tekrar deneyin.");

      setProcessingOfferId(
        null,
      );

      return;
    }

    await loadData();

    setProcessingOfferId(
      null,
    );
  }

  async function handleOpenConversation(
    jobId: number,
  ) {
    setError("");

    const { data, error } =
      await supabase.rpc(
        "get_or_create_conversation",
        {
          p_job_id: jobId,
        },
      );

    if (error) {
      console.error(
        "Open conversation error:",
        error,
      );
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      return;
    }

    const conversationId = Number(
      data,
    );

    if (
      !Number.isFinite(
        conversationId,
      ) ||
      conversationId <= 0
    ) {
      setError(
        "Sohbet oluşturulamadı.",
      );
      return;
    }

    openMessagesDockConversation(conversationId, jobId);
  }

  function toggleOfferSelection(
    offerId: number,
  ) {
    setSelectedOffers(
      (current) => {
        if (
          current.includes(
            offerId,
          )
        ) {
          return current.filter(
            (id) =>
              id !== offerId,
          );
        }

        if (
          current.length >=
          3
        ) {
          return current;
        }

        return [
          ...current,
          offerId,
        ];
      },
    );
  }

  function openComparison(
    jobId: number,
  ) {
    const jobOffers =
      offersByJob[jobId] ??
      [];

    const availableOffers =
      getSortedOffers(
        jobOffers,
      );

    const selectedForJob =
      availableOffers
        .filter((offer) =>
          selectedOffers.includes(
            offer.id,
          ),
        )
        .map(
          (offer) =>
            offer.id,
        );

    if (
      selectedForJob.length <
      2
    ) {
      setError(
        "Karşılaştırmak için en az 2 teklif seçmelisin.",
      );

      return;
    }

    setComparisonJobId(
      jobId,
    );

    setError("");
  }

  const comparisonOffers =
    useMemo(() => {
      if (
        comparisonJobId ===
        null
      ) {
        return [];
      }

      const jobOffers =
        offersByJob[
          comparisonJobId
        ] ?? [];

      return jobOffers.filter(
        (offer) =>
          selectedOffers.includes(
            offer.id,
          ),
      );
    }, [
      comparisonJobId,
      offersByJob,
      selectedOffers,
    ]);

  const visibleJobs = useMemo(() => {
    const search = jobSearch.trim().toLocaleLowerCase("tr-TR");

    return jobs.filter((job) => {
      if (
        jobStatusFilter !== "all" &&
        job.status !== jobStatusFilter
      ) {
        return false;
      }

      if (
        search &&
        !job.title
          .toLocaleLowerCase("tr-TR")
          .includes(search)
      ) {
        return false;
      }

      return true;
    });
  }, [jobs, jobSearch, jobStatusFilter]);

  const hasActiveJobFilters =
    jobSearch.trim() !== "" ||
    jobStatusFilter !== "all" ||
    offerFilter !== "all" ||
    offerSort !== "newest";

  function clearJobFilters() {
    setJobSearch("");
    setJobStatusFilter("all");
    setOfferFilter("all");
    setOfferSort("newest");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-zinc-500">
            İlanlar yükleniyor...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-6xl">
        {previewUser && (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
            <div className="text-sm font-semibold text-amber-800">
              Kullanıcı önizlemesi aktif
            </div>

            <div className="mt-1 text-sm text-amber-700">
              Bu sayfadaki ilanlar seçilen
              Proje Sahibi hesabına göre
              gösteriliyor.
            </div>

            <div className="mt-1 text-xs text-amber-600">
              {previewUser.full_name ||
                "İsimsiz kullanıcı"}
              {" · "}
              {previewUser.email ||
                "E-posta yok"}
            </div>
          </div>
        )}

        <div className="mb-10">
          <p className="text-sm font-medium text-zinc-500">
            Proje Sahibi Paneli
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            İlanlarım
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Yayınladığın ilanları ve
            gelen teklifleri buradan
            yönetebilirsin.
          </p>
        </div>

        {showPublishedNotice ? (
          <div className="mb-8 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-sm font-medium text-zinc-900">
              İlanın yayınlandı.
            </p>
            {jobs[0]?.title ? (
              <p className="mt-1 text-sm font-medium text-zinc-800">
                {jobs[0].title}
              </p>
            ) : null}
            {jobs[0]?.target_provider_id ? (
              <p className="mt-1 text-sm text-zinc-600">
                {providerNamesById[jobs[0].target_provider_id]
                  ? `${providerNamesById[jobs[0].target_provider_id]}'a bildirim gönderildi. Ayrıca eşleşen diğer uzmanlar da ilanını görebilir ve teklif verebilir.`
                  : "Seçtiğin uzmana bildirim gönderildi. Ayrıca eşleşen diğer uzmanlar da ilanını görebilir ve teklif verebilir."}
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-600">
                İlanın, eşleşen uzmanların görebileceği şekilde
                yayınlandı.
              </p>
            )}
          </div>
        ) : null}

        {jobs.length > 0 && (
          <label className="mb-8 flex max-w-xl flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-700">
                İlan ara
              </span>
              <input
                type="search"
                value={jobSearch}
                onChange={(event) =>
                  setJobSearch(event.target.value)
                }
                placeholder="İlan başlığına göre ara"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
            </label>
        )}

        {jobs.length > 0 && (
          <div className="mb-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-700">
                  İlan durumu
                </span>
                <select
                  value={jobStatusFilter}
                  onChange={(event) =>
                    setJobStatusFilter(
                      event.target.value as
                        | "all"
                        | Job["status"],
                    )
                  }
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                >
                  <option value="all">Tümü</option>
                  <option value="open">Açık</option>
                  <option value="in_progress">Devam ediyor</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="closed">Kapalı</option>
                  <option value="cancelled">İptal edildi</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {hasActiveJobFilters && (
                <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
                  Filtreler aktif
                </span>
              )}

              {jobSearch.trim() && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                  Arama: {jobSearch.trim()}
                </span>
              )}

              {jobStatusFilter !== "all" && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                  Durum: {getStatusLabel(jobStatusFilter)}
                </span>
              )}

              {offerFilter !== "all" && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                  Teklif:{" "}
                  {offerFilter === "pending"
                    ? "Bekleyenler"
                    : offerFilter === "accepted"
                      ? "Kabul edilenler"
                      : "Reddedilenler"}
                </span>
              )}

              {offerSort !== "newest" && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                  Sıralama değişti
                </span>
              )}

              <p className="text-sm text-zinc-500">
                {visibleJobs.length} / {jobs.length} ilan
              </p>

              {hasActiveJobFilters && (
                <button
                  type="button"
                  onClick={clearJobFilters}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Filtreleri temizle
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => {
                void loadData();
              }}
              className="text-sm font-medium text-red-800 underline-offset-2 hover:underline"
            >
              Tekrar dene
            </button>
          </div>
        )}

        {!error && jobs.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center">
            <h2 className="text-lg font-medium text-zinc-900">
              Henüz ilan yayınlamadın
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              İlk ilanını oluşturarak
              uygun uzmanlardan teklif
              almaya başlayabilirsin.
            </p>

            <Link
              href="/jobs/new"
              className="mt-6 inline-flex rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              İlan oluştur
            </Link>
          </div>
        ) : !error && visibleJobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
            <h2 className="text-lg font-medium text-zinc-900">
              Bu filtrelere uyan ilan yok.
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Arama veya durum filtresini değiştirerek
              tekrar dene.
            </p>

            <button
              type="button"
              onClick={clearJobFilters}
              className="mt-5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Filtreleri temizle
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {visibleJobs.map((job) => {
              const allOffers =
                offersByJob[job.id] ??
                [];

              const sortedOffers =
                getSortedOffers(
                  allOffers,
                );

              const selectedForThisJob =
                sortedOffers.filter(
                  (offer) =>
                    selectedOffers.includes(
                      offer.id,
                    ),
                );

              const acceptedOffer =
                allOffers.find(
                  (offer) =>
                    offer.status ===
                    "accepted",
                );

              const pendingOfferCount =
                allOffers.filter(
                  (offer) => offer.status === "pending",
                ).length;

              return (
                <section
                  key={job.id}
                  className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300"
                  onClick={(event) => {
                    const target =
                      event.target as HTMLElement;

                    if (
                      target.closest(
                        "a, button, select, input, textarea, label",
                      )
                    ) {
                      return;
                    }

                    router.push(
                      `/jobs/${job.public_id || job.id}`,
                    );
                  }}
                >
                  <Link
                    href={`/jobs/${job.public_id || job.id}`}
                    className="-mx-2 flex flex-col gap-5 rounded-xl border-b border-zinc-100 px-2 pb-6 transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 md:flex-row md:items-start md:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-zinc-900">
                          {job.title}
                        </h2>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                            job.status,
                          )}`}
                        >
                          {getStatusLabel(
                            job.status,
                          )}
                        </span>

                        {job.status === "open" &&
                        job.target_provider_id ? (
                          <span className="text-xs font-medium text-zinc-500">
                            Davet edildi
                          </span>
                        ) : null}
                      </div>

                      {pendingOfferCount > 0 ? (
                        <p className="mt-2 text-sm text-zinc-500">
                          {pendingOfferCount} teklif bekliyor
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                        {job.service && (
                          <span className="font-medium text-zinc-700">
                            {job.service.category
                              ?.name &&
                            job.service.category.name.toLocaleLowerCase(
                              "tr-TR",
                            ) !==
                              job.service.name.toLocaleLowerCase(
                                "tr-TR",
                              )
                              ? `${job.service.category.name} / `
                              : ""}
                            {job.service.name}
                          </span>
                        )}

                        {job.service && (
                          <span className="text-zinc-300">
                            •
                          </span>
                        )}

                        <span className="text-zinc-500">
                          {getLocationLabel(
                            job.location_type,
                          )}
                        </span>

                        {job.city && (
                          <>
                            <span className="text-zinc-300">
                              •
                            </span>

                            <span className="text-zinc-500">
                              {job.city}
                            </span>
                          </>
                        )}

                        {job.budget !==
                          null && (
                          <>
                            <span className="text-zinc-300">
                              •
                            </span>

                            <span className="text-zinc-500">
                              Bütçe:{" "}
                              <span className="font-medium text-zinc-700">
                                {formatPrice(
                                  Number(
                                    job.budget,
                                  ),
                                )}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-xs text-zinc-400">
                        Yayınlanma
                      </p>

                      <p className="mt-1 text-sm text-zinc-600">
                        {formatDate(
                          job.created_at,
                        )}
                      </p>
                    </div>
                  </Link>

                  <div className="mt-4">
                    <ProjectTimeline
                      jobStatus={job.status}
                      pendingOfferCount={pendingOfferCount}
                    />
                  </div>

                  {job.status ===
                    "in_progress" && (
                    <div className="mt-6 flex flex-col gap-4 rounded-xl border border-blue-100 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-blue-900">
                          Bu iş devam ediyor
                        </p>

                        <p className="mt-1 text-sm text-blue-700">
                          {acceptedOffer
                            ? `${
                                acceptedOffer.provider?.full_name?.trim() ||
                                "İsimsiz Uzman"
                              } — ${formatPrice(
                                Number(
                                  acceptedOffer.price,
                                ),
                              )}`
                            : "Kabul edilen uzman işi tamamlandığında burada güncellenir."}
                        </p>
                      </div>

                      {previewUser ? (
                        <span className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700">
                          Önizlemede işlem yapılamaz
                        </span>
                      ) : (
                        <div className="flex flex-col gap-2 sm:items-end">
                          {acceptedOffer && (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenConversation(
                                  job.id,
                                )
                              }
                              className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-800 transition hover:bg-blue-100"
                            >
                              Mesajlaş
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {job.status ===
                    "completed" && (
                    <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50 p-5">
                      <p className="font-medium text-emerald-900">
                        {reviewedJobIds[job.id]
                          ? "Bu iş tamamlandı. Değerlendirmen alındı."
                          : "Bu iş tamamlandı."}
                      </p>

                      {reviewedJobIds[job.id] ? (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/jobs/${job.public_id || job.id}/review`,
                            )
                          }
                          className="mt-3 text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
                        >
                          Değerlendirmeyi gör
                        </button>
                      ) : (
                        <>
                          <p className="mt-1 text-sm text-emerald-700">
                            İş başarıyla tamamlandı
                            olarak işaretlendi.
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/jobs/${job.public_id || job.id}/review`,
                              )
                            }
                            className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
                          >
                            Uzmanı değerlendir
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <div className="mt-6">
                    <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-zinc-900">
                          Gelen Teklifler
                        </h3>

                        <p className="mt-1 text-sm text-zinc-500">
                          {allOffers.length}{" "}
                          teklif
                        </p>
                      </div>

                      {allOffers.length > 1 && (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <select
                            value={
                              offerFilter
                            }
                            onChange={(event) =>
                              setOfferFilter(
                                event.target
                                  .value as FilterOption,
                              )
                            }
                            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-zinc-400"
                          >
                            <option value="all">
                              Tüm teklifler
                            </option>

                            <option value="pending">
                              Bekleyenler
                            </option>

                            <option value="accepted">
                              Kabul edilenler
                            </option>

                            <option value="rejected">
                              Reddedilenler
                            </option>
                          </select>

                          <select
                            value={
                              offerSort
                            }
                            onChange={(event) =>
                              setOfferSort(
                                event.target
                                  .value as SortOption,
                              )
                            }
                            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-zinc-400"
                          >
                            <option value="newest">
                              En yeni
                            </option>

                            <option value="price_low">
                              Fiyat: düşükten
                              yükseğe
                            </option>

                            <option value="price_high">
                              Fiyat: yüksekten
                              düşüğe
                            </option>

                            <option value="experience_high">
                              Deneyim: yüksekten
                              düşüğe
                            </option>
                          </select>
                        </div>
                      )}
                    </div>

                    {sortedOffers.length ===
                    0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-8 text-center">
                        <p className="text-sm text-zinc-500">
                          Bu ilana henüz teklif
                          gelmedi.
                        </p>
                        {job.status === "open" ? (
                          <p className="mt-1 text-sm text-zinc-500">
                            Uygun uzmanlar ilanını görüp teklif
                            verebilir.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <div className="space-y-4">
                          {sortedOffers.map(
                            (offer) => {
                              const isSelected =
                                selectedOffers.includes(
                                  offer.id,
                                );

                              const provider =
                                offer.provider;

                              const matchingService =
                                getMatchingProviderService(
                                  job,
                                  provider,
                                );

                              const offerMessageExcerpt =
                                offer.message
                                  ? offer.message
                                      .trim()
                                      .length > 180
                                    ? `${offer.message.trim().slice(0, 180).trimEnd()}…`
                                    : offer.message.trim()
                                  : "";

                              return (
                                <div
                                  key={
                                    offer.id
                                  }
                                  className={`rounded-xl border bg-white p-4 ${
                                    isSelected
                                      ? "border-zinc-900"
                                      : "border-zinc-200"
                                  }`}
                                >
                                  <div className="flex gap-3">
                                    <input
                                      type="checkbox"
                                      checked={
                                        isSelected
                                      }
                                      onChange={() =>
                                        toggleOfferSelection(
                                          offer.id,
                                        )
                                      }
                                      className="mt-1 h-4 w-4 shrink-0"
                                    />

                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <h4 className="text-sm font-semibold text-zinc-900">
                                              {provider?.full_name?.trim() ||
                                                "İsimsiz Uzman"}
                                            </h4>

                                            <span
                                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                                offer.status ===
                                                "pending"
                                                  ? "bg-amber-50 text-amber-700"
                                                  : offer.status ===
                                                      "accepted"
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-red-50 text-red-700"
                                              }`}
                                            >
                                              {offer.status ===
                                              "pending"
                                                ? "Bekliyor"
                                                : offer.status ===
                                                    "accepted"
                                                  ? "Kabul edildi"
                                                  : "Reddedildi"}
                                            </span>
                                          </div>

                                          <p className="mt-1 text-xs text-zinc-500">
                                            {getReviewSummaryLabel(
                                              provider?.reviewAverage,
                                              provider?.reviewCount,
                                            )}
                                          </p>

                                          <p className="mt-1 text-xs text-zinc-500">
                                            {[
                                              `${provider?.experience_years ?? 0} yıl deneyim`,
                                              provider?.city?.trim() ||
                                                null,
                                              provider
                                                ? getProviderWorkLabel(
                                                    provider,
                                                  )
                                                : null,
                                            ]
                                              .filter(
                                                Boolean,
                                              )
                                              .join(" · ")}
                                          </p>
                                        </div>

                                        <div className="shrink-0 sm:text-right">
                                          <p className="text-lg font-semibold tracking-tight text-zinc-900">
                                            {formatPrice(
                                              Number(
                                                offer.price,
                                              ),
                                            )}
                                          </p>

                                          <p className="mt-0.5 text-xs text-zinc-400">
                                            {`Proje bütçesi: ${
                                              job.budget !==
                                              null
                                                ? formatPrice(
                                                    Number(
                                                      job.budget,
                                                    ),
                                                  )
                                                : "Belirtilmedi"
                                            }`}
                                          </p>
                                        </div>
                                      </div>

                                      {matchingService ? (
                                        <p className="mt-3 text-xs text-zinc-500">
                                          {`Eşleşen hizmet · ${matchingService.name}`}
                                        </p>
                                      ) : null}

                                      {offerMessageExcerpt ? (
                                        <div className="mt-3">
                                          <p className="text-xs font-medium text-zinc-400">
                                            Teklif mesajı
                                          </p>

                                          <p className="mt-1 text-sm leading-6 text-zinc-600">
                                            {
                                              offerMessageExcerpt
                                            }
                                          </p>
                                        </div>
                                      ) : null}

                                      <p className="mt-3 text-xs text-zinc-400">
                                        {formatDate(
                                          offer.created_at,
                                        )}
                                      </p>

                                      <div className="mt-4 flex flex-wrap items-center gap-2">
                                        {provider ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              router.push(
                                                `/providers/${provider.user_id}`,
                                              )
                                            }
                                            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                                          >
                                            Profili Gör
                                          </button>
                                        ) : null}

                                        {offer.status ===
                                          "pending" &&
                                          job.status ===
                                            "open" &&
                                          (previewUser ? (
                                            <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-500">
                                              Önizlemede işlem yapılamaz
                                            </span>
                                          ) : (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleRejectOffer(
                                                    offer.id,
                                                  )
                                                }
                                                disabled={
                                                  processingOfferId ===
                                                  offer.id
                                                }
                                                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                                              >
                                                Reddet
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleAcceptOffer(
                                                    offer.id,
                                                  )
                                                }
                                                disabled={
                                                  processingOfferId ===
                                                  offer.id
                                                }
                                                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                                              >
                                                {processingOfferId ===
                                                offer.id
                                                  ? "İşleniyor..."
                                                  : "Kabul et"}
                                              </button>

                                              <p className="w-full text-xs text-zinc-500">
                                                Bu teklifi kabul ettiğinde diğer
                                                bekleyen teklifler reddedilir.
                                              </p>
                                            </>
                                          ))}

                                        {offer.status ===
                                          "accepted" && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleOpenConversation(
                                                job.id,
                                              )
                                            }
                                            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                                          >
                                            Mesajlaş
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>

                        {selectedForThisJob.length >=
                          2 && (
                          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-zinc-900">
                                {
                                  selectedForThisJob.length
                                }{" "}
                                teklif seçildi
                              </p>

                              <p className="mt-1 text-xs text-zinc-500">
                                Seçtiğin teklifleri
                                karşılaştırabilirsin.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                openComparison(
                                  job.id,
                                )
                              }
                              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                            >
                              Teklifleri
                              karşılaştır
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-6 flex flex-col items-stretch gap-3 border-t border-zinc-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
                    {job.status === "open" &&
                    pendingOfferCount > 0 ? (
                      <p className="text-center text-sm text-zinc-500 sm:text-left">
                        Teklif varken ilan düzenlenemez.
                      </p>
                    ) : job.status === "open" ? (
                      <Link
                        href={`/jobs/${job.public_id || job.id}/edit`}
                        className="rounded-lg border border-zinc-200 px-4 py-2 text-center text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                      >
                        İlanı Düzenle
                      </Link>
                    ) : null}

                    <Link
                      href={`/jobs/${job.public_id || job.id}`}
                      className="text-center text-sm font-medium text-zinc-900 transition hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 sm:text-right"
                    >
                      İlan Detayını Gör →
                    </Link>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {comparisonJobId !== null &&
        comparisonOffers.length >= 2 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
            <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-900">
                    Teklifleri karşılaştır
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Seçtiğin tekliflerin
                    detaylarını karşılaştır.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setComparisonJobId(
                      null,
                    )
                  }
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
                >
                  Kapat
                </button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left">
                      <th className="px-4 py-3 font-medium text-zinc-500">
                        Kriter
                      </th>

                      {comparisonOffers.map(
                        (offer) => (
                          <th
                            key={
                              offer.id
                            }
                            className="px-4 py-3 font-semibold text-zinc-900"
                          >
                            {offer.provider
                              ?.full_name?.trim() ||
                              `Teklif #${offer.id}`}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    <tr className="border-b border-zinc-100">
                      <td className="px-4 py-4 font-medium text-zinc-500">
                        Fiyat
                      </td>

                      {comparisonOffers.map(
                        (offer) => (
                          <td
                            key={
                              offer.id
                            }
                            className="px-4 py-4 font-semibold text-zinc-900"
                          >
                            {formatPrice(
                              Number(
                                offer.price,
                              ),
                            )}
                          </td>
                        ),
                      )}
                    </tr>

                    <tr className="border-b border-zinc-100">
                      <td className="px-4 py-4 font-medium text-zinc-500">
                        Deneyim
                      </td>

                      {comparisonOffers.map(
                        (offer) => (
                          <td
                            key={
                              offer.id
                            }
                            className="px-4 py-4 text-zinc-700"
                          >
                            {offer.provider
                              ?.experience_years ??
                              0}{" "}
                            yıl
                          </td>
                        ),
                      )}
                    </tr>

                    <tr className="border-b border-zinc-100">
                      <td className="px-4 py-4 font-medium text-zinc-500">
                        Şehir
                      </td>

                      {comparisonOffers.map(
                        (offer) => (
                          <td
                            key={
                              offer.id
                            }
                            className="px-4 py-4 text-zinc-700"
                          >
                            {offer.provider
                              ?.city ??
                              "-"}
                          </td>
                        ),
                      )}
                    </tr>

                    <tr className="border-b border-zinc-100">
                      <td className="px-4 py-4 font-medium text-zinc-500">
                        Çalışma şekli
                      </td>

                      {comparisonOffers.map(
                        (offer) => (
                          <td
                            key={
                              offer.id
                            }
                            className="px-4 py-4 text-zinc-700"
                          >
                            {offer.provider
                              ? getProviderWorkLabel(
                                  offer.provider,
                                )
                              : "-"}
                          </td>
                        ),
                      )}
                    </tr>

                    <tr className="border-b border-zinc-100">
                      <td className="px-4 py-4 font-medium text-zinc-500">
                        Hizmetler
                      </td>

                      {comparisonOffers.map(
                        (offer) => {
                          const comparisonJob =
                            jobs.find(
                              (job) =>
                                job.id ===
                                comparisonJobId,
                            );

                          const matchingService =
                            comparisonJob
                              ? getMatchingProviderService(
                                  comparisonJob,
                                  offer.provider,
                                )
                              : null;

                          const otherServices =
                            offer.provider?.services.filter(
                              (service) =>
                                service.id !==
                                comparisonJob
                                  ?.service?.id,
                            ) ?? [];

                          return (
                            <td
                              key={
                                offer.id
                              }
                              className="px-4 py-4 text-zinc-700"
                            >
                              {matchingService && (
                                <div className="mb-2">
                                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                    {
                                      matchingService.name
                                    }
                                  </span>
                                </div>
                              )}

                              {otherServices.length >
                              0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {otherServices
                                    .slice(
                                      0,
                                      4,
                                    )
                                    .map(
                                      (
                                        service,
                                      ) => (
                                        <span
                                          key={
                                            service.id
                                          }
                                          className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600"
                                        >
                                          {
                                            service.name
                                          }
                                        </span>
                                      ),
                                    )}

                                  {otherServices.length >
                                    4 && (
                                    <span className="text-xs text-zinc-400">
                                      +
                                      {otherServices.length -
                                        4}{" "}
                                      hizmet
                                    </span>
                                  )}
                                </div>
                              ) : !matchingService ? (
                                "-"
                              ) : null}
                            </td>
                          );
                        },
                      )}
                    </tr>

                    <tr>
                      <td className="px-4 py-4 font-medium text-zinc-500">
                        Mesaj
                      </td>

                      {comparisonOffers.map(
                        (offer) => (
                          <td
                            key={
                              offer.id
                            }
                            className="px-4 py-4 leading-6 text-zinc-600"
                          >
                            {offer.message ??
                              "-"}
                          </td>
                        ),
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
    </main>
  );
}