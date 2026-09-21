"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getPreviewUser } from "@/lib/preview";
import { openMessagesDockConversation } from "@/components/MessagesDock";
import { ProjectTimeline } from "@/components/ProjectTimeline";
import { ensureCanonicalJobRoute, jobHref } from "@/lib/jobs/public-id";
import { rememberRecentJob } from "@/components/recent-jobs";

type Job = {
  id: number;
  public_id: string;
  title: string;
  description: string | null;
  budget: number | null;
  city: string | null;
  location_type: "remote" | "on_site" | "hybrid";
  status: "open" | "in_progress" | "completed" | "cancelled";
  category_name: string | null;
  service_name: string | null;
  service_id: number | null;
  created_at: string;
  customer_id: string;
  target_provider_id: string | null;
};

type ViewerMatchProfile = {
  city: string | null;
  can_work_remote: boolean | null;
  can_work_on_site: boolean | null;
  serviceIds: number[] | null;
};

function sameCity(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const a = left?.trim() ?? "";
  const b = right?.trim() ?? "";

  if (!a || !b) {
    return false;
  }

  return a === b;
}

function getProviderMatchReasons(
  job: Job,
  viewer: ViewerMatchProfile | null,
) {
  if (!viewer) {
    return [];
  }

  const reasons: string[] = [];

  if (
    job.service_id &&
    viewer.serviceIds !== null &&
    viewer.serviceIds.includes(job.service_id)
  ) {
    reasons.push("Bu hizmeti veriyorsunuz");
  }

  if (
    job.location_type === "remote" &&
    viewer.can_work_remote === true
  ) {
    reasons.push("Uzaktan çalışmaya açıksınız");
  }

  if (job.location_type === "on_site") {
    if (viewer.can_work_on_site === true) {
      reasons.push("Yerinde çalışmaya açıksınız");
    }

    if (
      viewer.can_work_on_site === true &&
      sameCity(job.city, viewer.city)
    ) {
      reasons.push("Çalışma şehriniz proje ile eşleşiyor");
    }
  }

  if (job.location_type === "hybrid") {
    if (
      viewer.can_work_remote === true &&
      viewer.can_work_on_site === true
    ) {
      reasons.push("Hibrit çalışma şekline uygunsunuz");
    }

    if (
      viewer.can_work_on_site === true &&
      sameCity(job.city, viewer.city)
    ) {
      reasons.push("Çalışma şehriniz proje ile eşleşiyor");
    }
  }

  return reasons;
}

type Offer = {
  id: number;
  provider_id: string;
  price: number;
  message: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

type CancellationReason =
  | "no_longer_needed"
  | "found_external_provider"
  | "no_suitable_budget"
  | "created_by_mistake"
  | "project_postponed"
  | "other";

const CANCELLATION_REASONS: Array<{
  value: CancellationReason;
  label: string;
}> = [
  {
    value: "no_longer_needed",
    label: "Artık bu hizmete ihtiyacım yok",
  },
  {
    value: "found_external_provider",
    label: "Dışarıdan bir uzman buldum",
  },
  {
    value: "no_suitable_budget",
    label: "Bütçeme uygun teklif alamadım",
  },
  {
    value: "created_by_mistake",
    label: "İlanı yanlış oluşturdum",
  },
  {
    value: "project_postponed",
    label: "Projeyi erteledim",
  },
  {
    value: "other",
    label: "Başka bir nedenle",
  },
];

type ProviderService = {
  id: number;
  name: string;
};

type Provider = {
  id: string;
  full_name: string | null;
  experience_years: number;
  city: string | null;
  location_type: "remote" | "on_site" | "hybrid";
  can_work_remote: boolean;
  can_work_on_site: boolean;
  services: ProviderService[];
  reviewAverage: string | null;
  reviewCount: number;
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
    const total = ratings.reduce((sum, value) => sum + value, 0);

    summaries[providerId] = {
      average: (Math.round((total / ratings.length) * 10) / 10).toFixed(
        1,
      ),
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

function getProviderWorkLabel(provider: Provider) {
  if (provider.can_work_remote && provider.can_work_on_site) {
    return "Uzaktan + Yerinde";
  }

  if (provider.can_work_remote) {
    return "Uzaktan";
  }

  if (provider.can_work_on_site) {
    return "Yerinde";
  }

  if (provider.location_type === "on_site") {
    return "Yerinde";
  }

  if (provider.location_type === "hybrid") {
    return "Uzaktan + Yerinde";
  }

  return "Uzaktan";
}

function emptyProvider(
  id: string,
  fullName: string | null,
): Provider {
  return {
    id,
    full_name: fullName,
    experience_years: 0,
    city: null,
    location_type: "remote",
    can_work_remote: false,
    can_work_on_site: false,
    services: [],
    reviewAverage: null,
    reviewCount: 0,
  };
}

export default function JobDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  const jobId =
    typeof params.id === "string"
      ? params.id
      : "";

  const [job, setJob] =
    useState<Job | null>(null);

  const [offers, setOffers] =
    useState<Offer[]>([]);

  const [providers, setProviders] =
    useState<Record<string, Provider>>({});

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [processingOfferId, setProcessingOfferId] =
    useState<number | null>(null);

  const [processingAction, setProcessingAction] =
    useState<"accept" | "reject" | null>(
      null,
    );

  const [actionError, setActionError] =
    useState("");

  const [openingConversation, setOpeningConversation] =
    useState(false);

  const [completingJob, setCompletingJob] =
    useState(false);

  const [cancelStep, setCancelStep] = useState<
    null | "confirm" | "reason"
  >(null);
  const [cancellationReason, setCancellationReason] =
    useState<CancellationReason | "">("");
  const [cancellationNote, setCancellationNote] =
    useState("");
  const [cancellingJob, setCancellingJob] =
    useState(false);
  const [cancelSucceeded, setCancelSucceeded] =
    useState(false);

  const [hasReview, setHasReview] =
    useState(false);

  const [previewUser, setPreviewUser] =
    useState<ReturnType<
      typeof getPreviewUser
    >>(null);

  const [viewerMatchProfile, setViewerMatchProfile] =
    useState<ViewerMatchProfile | null>(null);

  useEffect(() => {
    setPreviewUser(getPreviewUser());
  }, []);

  useEffect(() => {
    if (!jobId) {
      setError("Bu içeriğe şu an erişilemiyor.");
      setLoading(false);
      return;
    }

    loadJob();
  }, [jobId]);

  async function loadJob() {
    setLoading(true);
    setError("");

    const currentPreviewUser =
      getPreviewUser();

    if (currentPreviewUser) {
      await loadPreviewJob(
        currentPreviewUser,
      );
    } else {
      await loadRealJob();
    }
  }

  async function loadRealJob() {
    setActionError("");
    setViewerMatchProfile(null);

    const resolved = await ensureCanonicalJobRoute(
      supabase,
      jobId,
      router,
    );

    if (resolved.status === "redirect") {
      return;
    }

    if (resolved.status === "missing") {
      setError("Bu içeriğe şu an erişilemiyor.");
      setLoading(false);
      return;
    }

    const internalId = resolved.id;

    const { data, error: jobError } =
      await supabase.rpc(
        "get_job_for_offer",
        {
          p_job_id: internalId,
        },
      );

    const jobRow = Array.isArray(data)
      ? data[0]
      : data;

    if (jobError || !jobRow) {
      console.error(
        "Job detail error:",
        jobError,
      );

      setError(
        "Bu içeriğe şu an erişilemiyor.",
      );

      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id ?? null);

    let categoryName: string | null =
      jobRow.category_name ??
      jobRow.job_category_name ??
      null;

    let serviceName: string | null =
      jobRow.service_name ??
      jobRow.job_service_name ??
      null;

    if (jobRow.service_id && !categoryName) {
      const { data: serviceData } =
        await supabase
          .from("services")
          .select(
            `
              name,
              category:categories (
                name
              )
            `,
          )
          .eq("id", jobRow.service_id)
          .maybeSingle();

      if (serviceData) {
        serviceName =
          serviceName ??
          serviceData.name ??
          null;

        const category = Array.isArray(
          serviceData.category,
        )
          ? serviceData.category[0]
          : serviceData.category;

        categoryName =
          category?.name ?? categoryName;
      }
    }

    let createdAt =
      jobRow.created_at ??
      jobRow.job_created_at ??
      "";

    let targetProviderId: string | null =
      typeof jobRow.target_provider_id === "string"
        ? jobRow.target_provider_id
        : null;

    const { data: jobMetaRow } = await supabase
      .from("jobs")
      .select("created_at, target_provider_id, customer_id, status")
      .eq("id", internalId)
      .maybeSingle();

    if (!createdAt) {
      createdAt = jobMetaRow?.created_at ?? "";
    }

    if (
      typeof jobMetaRow?.target_provider_id === "string" &&
      jobMetaRow.target_provider_id
    ) {
      targetProviderId = jobMetaRow.target_provider_id;
    }

    const customerId =
      typeof jobRow.customer_id === "string" && jobRow.customer_id
        ? jobRow.customer_id
        : typeof jobRow.job_customer_id === "string" &&
            jobRow.job_customer_id
          ? jobRow.job_customer_id
          : typeof jobMetaRow?.customer_id === "string"
            ? jobMetaRow.customer_id
            : "";

    const jobStatus = String(
      jobRow.status ??
        jobRow.job_status ??
        jobMetaRow?.status ??
        "",
    )
      .trim()
      .toLowerCase();

    const normalizedJob: Job = {
      id: jobRow.id,
      public_id: resolved.publicId,
      title: jobRow.title,
      description:
        jobRow.description,
      budget: jobRow.budget,
      city: jobRow.city,
      location_type:
        jobRow.location_type,
      status: jobStatus as Job["status"],
      category_name: categoryName,
      service_name: serviceName,
      service_id: jobRow.service_id
        ? Number(jobRow.service_id)
        : null,
      created_at: createdAt,
      customer_id: customerId,
      target_provider_id: targetProviderId,
    };

    setJob(normalizedJob);

    const {
      data: offersData,
      error: offersError,
    } = await supabase
      .from("offers")
      .select(
        `
          id,
          provider_id,
          price,
          message,
          status,
          created_at
        `,
      )
      .eq("job_id", internalId)
      .order("created_at", {
        ascending: false,
      });

    if (offersError) {
      console.error(
        "Offers error:",
        offersError,
      );

      setActionError("Bir hata oluştu. Lütfen tekrar deneyin.");
    }

    const normalizedOffers =
      (offersData ?? []) as Offer[];

    setOffers(normalizedOffers);

    if (normalizedOffers.length > 0) {
      await loadProviders(
        normalizedOffers.map(
          (offer) =>
            offer.provider_id,
        ),
        user?.id ?? null,
      );
    }

    const viewerId = user?.id ?? null;
    const isJobOwner =
      viewerId === normalizedJob.customer_id;
    const hasAcceptedOffer = normalizedOffers.some(
      (offer) =>
        offer.provider_id === viewerId &&
        offer.status === "accepted",
    );

    if (
      !isJobOwner &&
      normalizedJob.status !== "open" &&
      !hasAcceptedOffer
    ) {
      setJob(null);
      setOffers([]);
      setViewerMatchProfile(null);
      setError("Bu içeriğe şu an erişilemiyor.");
      setLoading(false);
      return;
    }

    if (viewerId && !isJobOwner) {
      const { data: providerProfile } = await supabase
        .from("provider_profiles")
        .select(
          "city, can_work_remote, can_work_on_site",
        )
        .eq("user_id", viewerId)
        .maybeSingle();

      const { data: providerServices, error: servicesError } =
        await supabase
          .from("provider_services")
          .select("service_id")
          .eq("provider_id", viewerId);

      setViewerMatchProfile({
        city:
          typeof providerProfile?.city === "string"
            ? providerProfile.city
            : null,
        can_work_remote:
          providerProfile == null
            ? null
            : Boolean(providerProfile.can_work_remote),
        can_work_on_site:
          providerProfile == null
            ? null
            : Boolean(providerProfile.can_work_on_site),
        serviceIds: servicesError
          ? null
          : ((providerServices ?? []) as Array<{
              service_id: number;
            }>).map((row) => Number(row.service_id)),
      });
    } else {
      setViewerMatchProfile(null);
    }

    if (
      viewerId &&
      normalizedJob.status === "completed" &&
      (isJobOwner || hasAcceptedOffer)
    ) {
      const { data: reviewRow, error: reviewLoadError } =
        await supabase
          .from("reviews")
          .select("id")
          .eq("job_id", normalizedJob.id)
          .eq("reviewer_id", viewerId)
          .maybeSingle();

      if (reviewLoadError) {
        console.error(
          "Review load error:",
          reviewLoadError,
        );
      }

      setHasReview(Boolean(reviewRow));
    } else {
      setHasReview(false);
    }

    rememberRecentJob(
      {
        id: normalizedJob.id,
        publicId: normalizedJob.public_id,
        title: normalizedJob.title,
        description: normalizedJob.description?.trim() || null,
        categoryName: normalizedJob.category_name?.trim() || null,
        serviceName: normalizedJob.service_name?.trim() || null,
        budget: normalizedJob.budget,
        budgetMin: null,
        budgetMax: null,
        locationType: normalizedJob.location_type,
        city: normalizedJob.city?.trim() || null,
      },
      user?.id ?? null,
    );

    setLoading(false);
  }

  async function loadPreviewJob(
    currentPreviewUser: NonNullable<
      ReturnType<typeof getPreviewUser>
    >,
  ) {
    const resolved = await ensureCanonicalJobRoute(
      supabase,
      jobId,
      router,
    );

    if (resolved.status === "redirect") {
      return;
    }

    if (resolved.status === "missing") {
      setError("Bu içeriğe şu an erişilemiyor.");
      setLoading(false);
      return;
    }

    const {
      data,
      error: previewError,
    } = await supabase.rpc(
      "admin_preview_customer_jobs",
      {
        p_user_id:
          currentPreviewUser.id,
      },
    );

    if (previewError) {
      console.error(
        "Admin preview job error:",
        previewError,
      );

      setError("Bu içeriğe şu an erişilemiyor.");

      setLoading(false);
      return;
    }

    const rows = data ?? [];

    const row = rows.find(
      (item: {
        job_id: number;
      }) =>
        Number(item.job_id) ===
        resolved.id,
    );

    if (!row) {
      setError(
        "Bu içeriğe şu an erişilemiyor.",
      );

      setLoading(false);
      return;
    }

    const normalizedJob: Job = {
      id: row.job_id,
      public_id: resolved.publicId,
      title: row.job_title,
      description:
        row.job_description,
      budget:
        row.job_budget !== null
          ? Number(row.job_budget)
          : null,
      city: row.job_city,
      location_type:
        row.job_location_type,
      status:
        row.job_status,
      category_name:
        row.job_category_name ?? null,
      service_name:
        row.job_service_name ?? null,
      service_id: row.job_service_id
        ? Number(row.job_service_id)
        : null,
      created_at:
        row.job_created_at,
      customer_id:
        row.job_customer_id,
      target_provider_id:
        typeof row.target_provider_id ===
          "string"
          ? row.target_provider_id
          : typeof row.job_target_provider_id ===
              "string"
            ? row.job_target_provider_id
            : null,
    };

    setJob(normalizedJob);

    setCurrentUserId(null);
    setViewerMatchProfile(null);

    setOffers([]);

    setHasReview(false);

    setLoading(false);
  }

  async function loadProviders(
    providerIds: string[],
    viewerId: string | null,
  ) {
    const uniqueIds = [
      ...new Set(providerIds),
    ];

    const [profilesResult, servicesResult, reviewsResult] =
      await Promise.all([
        supabase.rpc("customer_get_provider_profiles", {
          p_provider_ids: uniqueIds,
        }),
        supabase.rpc("customer_get_provider_services", {
          p_provider_ids: uniqueIds,
        }),
        supabase
          .from("reviews")
          .select("provider_id, rating")
          .in("provider_id", uniqueIds),
      ]);

    if (profilesResult.error) {
      console.error(
        "Provider profiles error:",
        profilesResult.error,
      );
    }

    if (servicesResult.error) {
      console.error(
        "Provider services error:",
        servicesResult.error,
      );
    }

    if (reviewsResult.error) {
      console.error(
        "Provider reviews error:",
        reviewsResult.error,
      );
    }

    const servicesMap: Record<string, ProviderService[]> = {};

    for (const service of (servicesResult.data ?? []) as Array<{
      provider_id?: string;
      service_id?: number;
      service_name?: string | null;
    }>) {
      const providerId = service.provider_id;

      if (!providerId) {
        continue;
      }

      if (!servicesMap[providerId]) {
        servicesMap[providerId] = [];
      }

      servicesMap[providerId].push({
        id: Number(service.service_id),
        name: service.service_name ?? "",
      });
    }

    const reviewSummaries = summarizeProviderReviews(
      (reviewsResult.data ?? []) as Array<{
        provider_id?: string | null;
        rating?: number | null;
      }>,
    );

    const providerMap: Record<
      string,
      Provider
    > = {};

    for (const provider of (profilesResult.data ??
      []) as Array<{
      user_id?: string;
      provider_id?: string;
      full_name: string | null;
      experience_years?: number | null;
      city?: string | null;
      location_type?: "remote" | "on_site" | "hybrid" | null;
      can_work_remote?: boolean | null;
      can_work_on_site?: boolean | null;
    }>) {
      const providerUserId =
        provider.user_id ??
        provider.provider_id;

      if (!providerUserId) {
        continue;
      }

      const canWorkRemote = Boolean(provider.can_work_remote);
      const canWorkOnSite = Boolean(provider.can_work_on_site);
      let locationType: Provider["location_type"] =
        provider.location_type ?? "remote";

      if (canWorkRemote && canWorkOnSite) {
        locationType = "hybrid";
      } else if (canWorkOnSite) {
        locationType = "on_site";
      } else if (canWorkRemote) {
        locationType = "remote";
      }

      providerMap[providerUserId] = {
        id: providerUserId,
        full_name: provider.full_name,
        experience_years: Number(provider.experience_years ?? 0),
        city: provider.city ?? null,
        location_type: locationType,
        can_work_remote: canWorkRemote,
        can_work_on_site: canWorkOnSite,
        services: servicesMap[providerUserId] ?? [],
        reviewAverage: reviewSummaries[providerUserId]?.average ?? null,
        reviewCount: reviewSummaries[providerUserId]?.count ?? 0,
      };
    }

    if (
      viewerId &&
      uniqueIds.includes(viewerId) &&
      !providerMap[viewerId]
    ) {
      const { data: selfProfile } =
        await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", viewerId)
          .maybeSingle();

      if (selfProfile) {
        providerMap[viewerId] = emptyProvider(
          viewerId,
          selfProfile.full_name,
        );
      }
    }

    setProviders(providerMap);
  }

  async function handleAcceptOffer(
    offerId: number,
  ) {
    if (previewUser) {
      return;
    }

    if (job?.status !== "open") {
      setActionError(
        "Bu iş için artık teklif kabul edilemez.",
      );
      return;
    }

    setProcessingOfferId(offerId);
    setProcessingAction("accept");
    setActionError("");

    const { error: acceptError } =
      await supabase.rpc(
        "accept_offer",
        {
          p_offer_id: offerId,
        },
      );

    if (acceptError) {
      console.error(
        "Accept offer error:",
        acceptError,
      );

      setActionError("Bir hata oluştu. Lütfen tekrar deneyin.");

      setProcessingOfferId(null);
      setProcessingAction(null);
      return;
    }

    await loadRealJob();

    setProcessingOfferId(null);
    setProcessingAction(null);
  }

  async function handleRejectOffer(
    offerId: number,
  ) {
    if (previewUser) {
      return;
    }

    if (job?.status !== "open") {
      setActionError(
        "Bu iş için artık teklif reddedilemez.",
      );
      return;
    }

    setProcessingOfferId(offerId);
    setProcessingAction("reject");
    setActionError("");

    const { error: rejectError } =
      await supabase.rpc(
        "reject_offer",
        {
          p_offer_id: offerId,
        },
      );

    if (rejectError) {
      console.error(
        "Reject offer error:",
        rejectError,
      );

      setActionError("Bir hata oluştu. Lütfen tekrar deneyin.");

      setProcessingOfferId(null);
      setProcessingAction(null);
      return;
    }

    await loadRealJob();

    setProcessingOfferId(null);
    setProcessingAction(null);
  }

  async function handleCompleteJob() {
    if (previewUser || !job) {
      return;
    }

    const isAcceptedProvider =
      currentUserId !== null &&
      offers.some(
        (offer) =>
          offer.status === "accepted" &&
          offer.provider_id === currentUserId,
      );

    if (
      job.status !== "in_progress" ||
      !isAcceptedProvider
    ) {
      setActionError(
        "Yalnızca devam eden işler tamamlanabilir.",
      );
      return;
    }

    setCompletingJob(true);
    setActionError("");

    const { error: completeError } =
      await supabase.rpc(
        "complete_my_job",
        {
          p_job_id: job.id,
        },
      );

    if (completeError) {
      console.error(
        "Complete job error:",
        completeError,
      );

      setActionError("Bir hata oluştu. Lütfen tekrar deneyin.");

      setCompletingJob(false);
      return;
    }

    setCompletingJob(false);
    router.push(jobHref(job, "/review"));
  }

  function closeCancelFlow() {
    if (cancellingJob) {
      return;
    }

    setCancelStep(null);
    setCancellationReason("");
    setCancellationNote("");
  }

  async function handleCancelJob() {
    if (previewUser || !job) {
      return;
    }

    if (!cancellationReason) {
      setActionError("Geçerli bir iptal nedeni seç.");
      return;
    }

    if (
      cancellationReason === "other" &&
      cancellationNote.trim() === ""
    ) {
      setActionError("Diğer nedeni seçtiğinde açıklama yazmalısın.");
      return;
    }

    setCancellingJob(true);
    setActionError("");

    const { error: cancelError } = await supabase.rpc(
      "cancel_my_job",
      {
        p_job_id: job.id,
        p_cancellation_reason: cancellationReason,
        p_cancellation_note:
          cancellationReason === "other"
            ? cancellationNote.trim()
            : null,
      },
    );

    if (cancelError) {
      console.error("Cancel job error:", cancelError);
      setActionError(
        cancelError.message ||
          "Bir hata oluştu. Lütfen tekrar deneyin.",
      );
      setCancellingJob(false);
      return;
    }

    setJob({
      ...job,
      status: "cancelled",
    });
    setCancelSucceeded(true);
    setCancelStep(null);
    setCancellationReason("");
    setCancellationNote("");
    setCancellingJob(false);
  }

  async function handleOpenConversation() {
    if (previewUser || !job) {
      return;
    }

    setOpeningConversation(true);
    setActionError("");

    const { data, error: conversationError } =
      await supabase.rpc(
        "get_or_create_conversation",
        {
          p_job_id: job.id,
        },
      );

    if (conversationError) {
      console.error(
        "Open conversation error:",
        conversationError,
      );
      setActionError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setOpeningConversation(false);
      return;
    }

    const conversationId = Number(data);

    if (
      !Number.isFinite(conversationId) ||
      conversationId <= 0
    ) {
      setActionError("Sohbet oluşturulamadı.");
      setOpeningConversation(false);
      return;
    }

    openMessagesDockConversation(
      conversationId,
      job.id,
    );
    setOpeningConversation(false);
  }

  function getLocationLabel() {
    if (!job) {
      return "-";
    }

    if (
      job.location_type ===
      "remote"
    ) {
      return "Uzaktan";
    }

    if (
      job.location_type ===
      "on_site"
    ) {
      return "Yerinde";
    }

    return "Uzaktan + Yerinde";
  }

  function getStatusLabel() {
    if (!job) {
      return "";
    }

    if (job.status === "open") {
      return "Teklif alıyor";
    }

    if (
      job.status === "in_progress"
    ) {
      return "Devam ediyor";
    }

    if (job.status === "cancelled") {
      return "İptal edildi";
    }

    return "Tamamlandı";
  }

  function getStatusClass() {
    if (!job) {
      return "bg-zinc-100 text-zinc-600";
    }

    if (job.status === "open") {
      return "bg-emerald-50 text-emerald-700";
    }

    if (job.status === "in_progress") {
      return "bg-blue-50 text-blue-700";
    }

    if (job.status === "cancelled") {
      return "bg-red-50 text-red-700";
    }

    return "bg-zinc-100 text-zinc-600";
  }

  function formatPrice(
    value: number | null,
  ) {
    if (value === null) {
      return "Belirtilmemiş";
    }

    return new Intl.NumberFormat(
      "tr-TR",
      {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0,
      },
    ).format(value);
  }

  function formatDate(
    value: string | null,
  ) {
    if (!value) {
      return "Belirtilmemiş";
    }

    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      },
    ).format(new Date(value));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-zinc-500">
            İlan yükleniyor...
          </p>
        </div>
      </main>
    );
  }

  if (error || !job) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => router.push("/jobs")}
            className="mb-6 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
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

  const isPreview =
    previewUser !== null;

  const isOwner =
    currentUserId === job.customer_id ||
    previewUser?.id === job.customer_id;

  const pendingOfferCount = offers.filter(
    (offer) => offer.status === "pending",
  ).length;

  const canManageOffers =
    !isPreview &&
    isOwner &&
    job.status === "open";

  const canCancelJob =
    !isPreview &&
    isOwner &&
    job.status === "open";

  const myOffer =
    currentUserId && !isOwner
      ? offers.find(
          (offer) =>
            offer.provider_id ===
            currentUserId,
        )
      : undefined;

  const canCompleteJob =
    !isPreview &&
    !isOwner &&
    currentUserId !== null &&
    job.status === "in_progress" &&
    myOffer?.status === "accepted";

  const acceptedOffer = offers.find(
    (offer) => offer.status === "accepted",
  );

  const acceptedProviderName =
    acceptedOffer
      ? providers[
          acceptedOffer.provider_id
        ]?.full_name?.trim() ||
        "İsimsiz Uzman"
      : null;

  const canReview =
    !isPreview &&
    currentUserId !== null &&
    currentUserId === job.customer_id &&
    job.status === "completed" &&
    Boolean(acceptedOffer);

  const isTargetedProvider =
    currentUserId !== null &&
    job.target_provider_id === currentUserId;

  const matchReasons =
    !isOwner && !isPreview
      ? getProviderMatchReasons(job, viewerMatchProfile)
      : [];

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        {isPreview && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Admin önizleme modu
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            router.push(isOwner ? "/my-jobs" : "/jobs")
          }
          className="mb-6 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          ← Geri dön
        </button>

        {cancelSucceeded ? (
          <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">
              İlan iptal edildi.
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Bu ilan artık yeni teklif alamaz.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push("/my-jobs")}
                className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                İşlerime Dön
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
              >
                Ana Sayfaya Git
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div
              className={
                isTargetedProvider
                  ? "border-b border-zinc-100 border-l-2 border-l-indigo-500 bg-indigo-50/40 px-6 py-7 sm:px-8"
                  : "border-b border-zinc-100 px-6 py-7 sm:px-8"
              }
            >
              <div className="flex items-center flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass()}`}>
                  {getStatusLabel()}
                </span>

                {isOwner && (
                  <>
                    <span className="text-zinc-300" aria-hidden="true">
                      •
                    </span>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                      Proje Sahibi
                    </span>
                  </>
                )}

                {!isOwner && (
                  <>
                    <span className="text-zinc-300" aria-hidden="true">
                      •
                    </span>
                    <span className="ml-0 inline-flex shrink-0 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700">
                      Uzman
                    </span>
                  </>
                )}

                {job.category_name && (
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                    {job.category_name}
                  </span>
                )}
              </div>

              {isTargetedProvider ? (
                <p className="mt-4 text-xs font-semibold text-indigo-600">
                  Sana özel proje
                </p>
              ) : null}

              <h1
                className={`text-3xl font-semibold tracking-tight text-zinc-900 ${
                  isTargetedProvider ? "mt-2" : "mt-4"
                }`}
              >
                {job.title}
              </h1>

              <p className="mt-3 text-sm text-zinc-500">
                İlan tarihi:{" "}
                {formatDate(
                  job.created_at,
                )}
              </p>

              <div className="mt-5">
                <ProjectTimeline
                  jobStatus={job.status}
                  pendingOfferCount={
                    offers.filter(
                      (offer) => offer.status === "pending",
                    ).length
                  }
                />
              </div>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                {job.service_name && (
                  <div>
                    <dt className="text-xs text-zinc-400">
                      Hizmet
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-zinc-800">
                      {job.service_name}
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-xs text-zinc-400">
                    Çalışma şekli
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-zinc-800">
                    {getLocationLabel()}
                  </dd>
                </div>

                {job.city && (
                  <div>
                    <dt className="text-xs text-zinc-400">
                      Konum
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-zinc-800">
                      {job.city}
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-xs text-zinc-400">
                    Bütçe
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-zinc-800">
                    {formatPrice(job.budget)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="px-6 py-7 sm:px-8">
              <section>
                <h2 className="text-base font-semibold text-zinc-900">
                  Proje açıklaması
                </h2>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-600">
                  {job.description ||
                    "Proje açıklaması belirtilmemiş."}
                </p>
              </section>

              {job.service_name && (
                <section className="mt-8">
                  <h2 className="text-base font-semibold text-zinc-900">
                    Aranan hizmet
                  </h2>

                  <div className="mt-3">
                    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700">
                      {job.service_name}
                    </span>
                  </div>
                </section>
              )}

              {matchReasons.length > 0 && (
                <section className="mt-8">
                  <h2 className="text-base font-semibold text-zinc-900">
                    Neden bu proje size uygun?
                  </h2>

                  <ul className="mt-3 space-y-2">
                    {matchReasons.map((reason) => (
                      <li
                        key={reason}
                        className="flex items-start gap-2 text-sm leading-6 text-zinc-600"
                      >
                        <span
                          className="mt-0.5 shrink-0 text-zinc-900"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {job.status ===
                "open" &&
                !isOwner &&
                !isPreview &&
                !myOffer && (
                  <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                    {isTargetedProvider ? (
                      <>
                        <p className="text-sm font-semibold text-indigo-600">
                          Bu proje senin için özel olarak oluşturuldu.
                        </p>

                        <p className="mt-2 text-sm leading-6 text-zinc-500">
                          Proje sahibi seni hedef uzman olarak seçti. Yine
                          de teklif göndererek projeye başvurman gerekiyor.
                        </p>
                      </>
                    ) : null}

                    <h2
                      className={`text-sm font-semibold text-zinc-900 ${
                        isTargetedProvider ? "mt-4" : ""
                      }`}
                    >
                      Bu proje için teklif vermek ister misin?
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      Uygun olduğunu düşünüyorsan teklif
                      göndererek proje sahibine ulaşabilirsin.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/jobs/${job.public_id}/offer`,
                        )
                      }
                      className="mt-4 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                    >
                      Teklif Ver
                    </button>
                  </div>
                )}

              {!isOwner &&
                !isPreview &&
                myOffer && (
                  <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      {myOffer.status ===
                      "pending"
                        ? "Teklifiniz gönderildi"
                        : myOffer.status ===
                            "accepted"
                          ? "Teklifiniz kabul edildi"
                          : "Teklifiniz reddedildi"}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      {myOffer.status === "pending"
                        ? "Müşteri teklifinizi inceliyor. Yanıt geldiğinde burada görebilirsiniz."
                        : myOffer.status === "accepted"
                          ? job.status === "completed"
                            ? "İş tamamlandı."
                            : "İş başladı. Müşteriyle iletişime geçebilirsiniz."
                          : "Bu teklif için artık işlem yapamazsınız."}
                    </p>

                    <p className="mt-3 text-lg font-semibold text-zinc-900">
                      {formatPrice(
                        myOffer.price,
                      )}
                    </p>

                    {myOffer.message && (
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        {myOffer.message}
                      </p>
                    )}

                    {myOffer.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => router.push("/my-offers")}
                        className="mt-4 text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
                      >
                        Tekliflerim
                      </button>
                    )}

                    {myOffer.status ===
                      "accepted" && (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenConversation()
                        }
                        disabled={
                          openingConversation
                        }
                        className="mt-4 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {openingConversation
                          ? "Açılıyor..."
                          : "Mesajlaş"}
                      </button>
                    )}
                  </div>
                )}

              {canCompleteJob && (
                  <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-5">
                    <h2 className="text-sm font-semibold text-blue-900">
                      İş devam ediyor
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-blue-700">
                      İş bittiğinde tamamlandı
                      olarak işaretleyebilirsin.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        handleCompleteJob()
                      }
                      disabled={
                        completingJob
                      }
                      className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {completingJob
                        ? "İşleniyor..."
                        : "İşi tamamlandı olarak işaretle"}
                    </button>
                  </div>
                )}

              {isOwner &&
                acceptedOffer && (
                  <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                    <h2 className="text-sm font-semibold text-emerald-900">
                      Kabul edilen uzman
                    </h2>

                    <p className="mt-2 text-sm font-medium text-emerald-900">
                      {acceptedProviderName}
                    </p>

                    <p className="mt-1 text-lg font-semibold text-emerald-950">
                      {formatPrice(
                        acceptedOffer.price,
                      )}
                    </p>

                    {!isPreview && (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenConversation()
                        }
                        disabled={
                          openingConversation
                        }
                        className="mt-4 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {openingConversation
                          ? "Açılıyor..."
                          : "Mesajlaş"}
                      </button>
                    )}
                  </div>
                )}

              {job.status === "completed" && (
                <div className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50 p-5">
                  {isOwner ? (
                    hasReview ? (
                      <>
                        <h2 className="text-sm font-semibold text-emerald-900">
                          İş tamamlandı. Değerlendirmeniz alındı.
                        </h2>

                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/jobs/${job.public_id}/review`,
                            )
                          }
                          className="mt-3 text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
                        >
                          Değerlendirmeyi gör
                        </button>
                      </>
                    ) : (
                      <>
                        <h2 className="text-sm font-semibold text-emerald-900">
                          İş tamamlandı. Uzmanı değerlendirin.
                        </h2>

                        {canReview ? (
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/jobs/${job.public_id}/review`,
                              )
                            }
                            className="mt-4 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
                          >
                            Uzmanı değerlendir
                          </button>
                        ) : null}
                      </>
                    )
                  ) : (
                    <>
                      <h2 className="text-sm font-semibold text-emerald-900">
                        İş tamamlandı.
                      </h2>

                      {myOffer?.status === "accepted" ? (
                        <>
                          <p className="mt-2 text-sm leading-6 text-emerald-700">
                            Bu işin sonucu profilinizdeki
                            değerlendirmelere yansıyabilir.
                          </p>

                          {!isPreview && !hasReview ? (
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/jobs/${job.public_id}/review`,
                                )
                              }
                              className="mt-4 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
                            >
                              Değerlendir
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-900">
                İlan Özeti
              </h2>

              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-xs text-zinc-400">
                    Bütçe
                  </p>

                  <p className="mt-1 text-lg font-semibold text-zinc-900">
                    {formatPrice(
                      job.budget,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-zinc-400">
                    Çalışma şekli
                  </p>

                  <p className="mt-1 text-sm font-medium text-zinc-800">
                    {getLocationLabel()}
                  </p>
                </div>

                {job.city && (
                  <div>
                    <p className="text-xs text-zinc-400">
                      Şehir
                    </p>

                    <p className="mt-1 text-sm font-medium text-zinc-800">
                      {job.city}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {(isOwner || offers.length > 0) && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Gelen teklifler
                </h2>

                <p className="mt-1 text-xs text-zinc-400">
                  {offers.length} teklif
                </p>

                {actionError && (
                  <p className="mt-3 text-sm text-red-600">
                    {actionError}
                  </p>
                )}

                <div className="mt-5 space-y-4">
                  {offers.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      Bu ilana henüz teklif
                      gelmedi.
                    </p>
                  ) : (
                  offers.map(
                    (offer) => {
                      const provider =
                        providers[
                          offer.provider_id
                        ];

                      const matchingService =
                        job.service_id && provider
                          ? provider.services.find(
                              (service) =>
                                service.id === job.service_id,
                            )
                          : null;

                      const serviceName =
                        matchingService?.name?.trim() ||
                        provider?.services[0]?.name?.trim() ||
                        job.service_name;

                      const isProcessing =
                        processingOfferId ===
                        offer.id;

                      return (
                        <div
                          key={offer.id}
                          className="rounded-xl border border-zinc-200 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-zinc-900">
                                {provider?.full_name?.trim() ||
                                  "İsimsiz Uzman"}
                              </p>

                              <p className="mt-1 text-xs text-zinc-500">
                                {getReviewSummaryLabel(
                                  provider?.reviewAverage,
                                  provider?.reviewCount,
                                )}
                              </p>

                              <p className="mt-1 text-xs text-zinc-500">
                                {[
                                  `${provider?.experience_years ?? 0} yıl deneyim`,
                                  provider?.city?.trim() || null,
                                  provider
                                    ? getProviderWorkLabel(provider)
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>

                            <p className="shrink-0 text-lg font-semibold text-zinc-900 sm:text-right">
                              {formatPrice(
                                offer.price,
                              )}
                            </p>
                          </div>

                          {serviceName ? (
                            <p className="mt-3 text-xs text-zinc-500">
                              {matchingService
                                ? `Eşleşen hizmet · ${serviceName}`
                                : serviceName}
                            </p>
                          ) : null}

                          {offer.message && (
                            <p className="mt-2 text-sm leading-6 text-zinc-500">
                              {offer.message}
                            </p>
                          )}

                          <p className="mt-3 text-xs text-zinc-400">
                            {formatDate(
                              offer.created_at,
                            )}
                          </p>

                          {provider ? (
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/providers/${offer.provider_id}`,
                                )
                              }
                              className="mt-3 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                            >
                              Profili Gör
                            </button>
                          ) : null}

                          {offer.status ===
                            "accepted" && (
                            <div className="mt-3">
                              <p className="text-xs font-medium text-emerald-700">
                                Kabul edildi
                              </p>

                              {isOwner &&
                                !isPreview && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenConversation()
                                    }
                                    disabled={
                                      openingConversation
                                    }
                                    className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {openingConversation
                                      ? "Açılıyor..."
                                      : "Mesajlaş"}
                                  </button>
                                )}
                            </div>
                          )}

                          {offer.status ===
                            "rejected" && (
                            <p className="mt-3 text-xs font-medium text-zinc-500">
                              Reddedildi
                            </p>
                          )}

                          {canManageOffers &&
                            offer.status ===
                              "pending" && (
                              <div className="mt-4">
                                <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAcceptOffer(
                                      offer.id,
                                    )
                                  }
                                  disabled={
                                    isProcessing
                                  }
                                  className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isProcessing &&
                                  processingAction ===
                                    "accept"
                                    ? "Kabul ediliyor..."
                                    : "Teklifi Kabul Et"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRejectOffer(
                                      offer.id,
                                    )
                                  }
                                  disabled={
                                    isProcessing
                                  }
                                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isProcessing &&
                                  processingAction ===
                                    "reject"
                                    ? "Reddediliyor..."
                                    : "Reddet"}
                                </button>
                                </div>

                                <p className="mt-2 text-xs text-zinc-500">
                                  Bu teklifi kabul ettiğinde diğer bekleyen
                                  teklifler reddedilir.
                                </p>
                              </div>
                            )}
                        </div>
                      );
                    },
                  )
                  )}
                </div>

                {canCancelJob ? (
                  <div className="mt-6 border-t border-zinc-100 pt-5">
                    <button
                      type="button"
                      disabled={pendingOfferCount > 0}
                      onClick={() => {
                        if (pendingOfferCount > 0) {
                          return;
                        }

                        setActionError("");
                        setCancelStep("confirm");
                      }}
                      className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      İşi İptal Et
                    </button>

                    {pendingOfferCount > 0 ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        Bekleyen teklif varken ilan iptal edilemez.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      </div>

      {cancelStep ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            {cancelStep === "confirm" ? (
              <>
                <h2 className="text-xl font-semibold text-zinc-900">
                  İlanı iptal etmek istediğine emin misin?
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Bu ilan iptal edildiğinde artık yeni teklif
                  alamazsın.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeCancelFlow}
                    className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                  >
                    Vazgeç
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActionError("");
                      setCancelStep("reason");
                    }}
                    className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                  >
                    Devam Et
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-zinc-900">
                  İlanı neden iptal ediyorsun?
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Bunu bilmek Project Match&apos;i geliştirmemize
                  yardımcı olur.
                </p>

                <fieldset className="mt-5 space-y-3">
                  <legend className="sr-only">
                    İptal nedeni
                  </legend>

                  {CANCELLATION_REASONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-start gap-3 text-sm text-zinc-800"
                    >
                      <input
                        type="radio"
                        name="cancellation_reason"
                        value={option.value}
                        checked={
                          cancellationReason === option.value
                        }
                        onChange={() =>
                          setCancellationReason(option.value)
                        }
                        className="mt-0.5"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </fieldset>

                {cancellationReason === "other" ? (
                  <label className="mt-5 block text-sm font-medium text-zinc-800">
                    Neden?
                    <textarea
                      value={cancellationNote}
                      onChange={(event) =>
                        setCancellationNote(event.target.value)
                      }
                      rows={4}
                      placeholder="İptal nedenini kısaca yazabilirsin."
                      className="mt-2 w-full resize-none rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                    />
                  </label>
                ) : null}

                {actionError ? (
                  <p className="mt-4 text-sm text-red-600">
                    {actionError}
                  </p>
                ) : null}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeCancelFlow}
                    disabled={cancellingJob}
                    className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Vazgeç
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleCancelJob();
                    }}
                    disabled={
                      cancellingJob ||
                      cancellationReason === "" ||
                      (cancellationReason === "other" &&
                        cancellationNote.trim() === "")
                    }
                    className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cancellingJob
                      ? "İptal ediliyor..."
                      : "İlanı İptal Et"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}