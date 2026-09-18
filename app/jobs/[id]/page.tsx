"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getPreviewUser } from "@/lib/preview";

type Job = {
  id: number;
  title: string;
  description: string | null;
  budget: number | null;
  city: string | null;
  location_type: "remote" | "on_site" | "hybrid";
  status: "open" | "in_progress" | "completed";
  category_name: string | null;
  service_name: string | null;
  created_at: string;
  customer_id: string;
};

type Offer = {
  id: number;
  provider_id: string;
  price: number;
  message: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

type Provider = {
  id: string;
  full_name: string | null;
};

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

  const [previewUser, setPreviewUser] =
    useState<ReturnType<
      typeof getPreviewUser
    >>(null);

  useEffect(() => {
    setPreviewUser(getPreviewUser());
  }, []);

  useEffect(() => {
    if (!jobId) {
      setError("İlan bulunamadı.");
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

    const { data, error: jobError } =
      await supabase.rpc(
        "get_job_for_offer",
        {
          p_job_id: Number(jobId),
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
        "Bu ilan görüntülenemiyor.",
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

    if (!createdAt) {
      const { data: jobCreatedAtRow } =
        await supabase
          .from("jobs")
          .select("created_at")
          .eq("id", Number(jobId))
          .maybeSingle();

      createdAt =
        jobCreatedAtRow?.created_at ??
        "";
    }

    const normalizedJob: Job = {
      id: jobRow.id,
      title: jobRow.title,
      description:
        jobRow.description,
      budget: jobRow.budget,
      city: jobRow.city,
      location_type:
        jobRow.location_type,
      status: jobRow.status,
      category_name: categoryName,
      service_name: serviceName,
      created_at: createdAt,
      customer_id:
        jobRow.customer_id,
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
      .eq("job_id", jobId)
      .order("created_at", {
        ascending: false,
      });

    if (offersError) {
      console.error(
        "Offers error:",
        offersError,
      );

      setActionError(
        offersError.message ||
          "Teklifler yüklenirken bir hata oluştu.",
      );
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
      setError("Bu ilan görüntülenemiyor.");
      setLoading(false);
      return;
    }

    setLoading(false);
  }

  async function loadPreviewJob(
    currentPreviewUser: NonNullable<
      ReturnType<typeof getPreviewUser>
    >,
  ) {
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

      setError(
        "İlan görüntülenirken bir hata oluştu.",
      );

      setLoading(false);
      return;
    }

    const rows = data ?? [];

    const row = rows.find(
      (item: {
        job_id: number;
      }) =>
        String(item.job_id) ===
        String(jobId),
    );

    if (!row) {
      setError(
        "Bu ilan görüntülenemiyor.",
      );

      setLoading(false);
      return;
    }

    const normalizedJob: Job = {
      id: row.job_id,
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
      created_at:
        row.job_created_at,
      customer_id:
        row.job_customer_id,
    };

    setJob(normalizedJob);

    setCurrentUserId(null);

    setOffers([]);

    setLoading(false);
  }

  async function loadProviders(
    providerIds: string[],
    viewerId: string | null,
  ) {
    const uniqueIds = [
      ...new Set(providerIds),
    ];

    const {
      data,
      error: providerError,
    } = await supabase.rpc(
      "customer_get_provider_profiles",
      {
        p_provider_ids: uniqueIds,
      },
    );

    if (providerError) {
      console.error(
        "Provider profiles error:",
        providerError,
      );
    }

    const providerMap: Record<
      string,
      Provider
    > = {};

    for (const provider of (data ??
      []) as Array<{
      user_id?: string;
      provider_id?: string;
      full_name: string | null;
    }>) {
      const providerUserId =
        provider.user_id ??
        provider.provider_id;

      if (!providerUserId) {
        continue;
      }

      providerMap[providerUserId] = {
        id: providerUserId,
        full_name: provider.full_name,
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
        providerMap[viewerId] = {
          id: viewerId,
          full_name:
            selfProfile.full_name,
        };
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

      setActionError(
        acceptError.message ||
          "Teklif kabul edilirken bir hata oluştu.",
      );

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

      setActionError(
        rejectError.message ||
          "Teklif reddedilirken bir hata oluştu.",
      );

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

    if (job.status !== "in_progress") {
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

      setActionError(
        completeError.message ||
          "İş tamamlanırken bir hata oluştu.",
      );

      setCompletingJob(false);
      return;
    }

    await loadRealJob();
    setCompletingJob(false);
  }

  async function handleOpenConversation() {
    if (previewUser) {
      return;
    }

    setOpeningConversation(true);
    setActionError("");

    const { data, error: conversationError } =
      await supabase.rpc(
        "get_or_create_conversation",
        {
          p_job_id: Number(jobId),
        },
      );

    if (conversationError) {
      setActionError(
        conversationError.message ||
          "Mesajlaşma başlatılırken bir hata oluştu.",
      );
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

    router.push(`/messages/${conversationId}`);
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
            onClick={() => router.back()}
            className="mb-6 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
          >
            ← Geri dön
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm text-red-700">
              {error ||
                "İlan bulunamadı."}
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

  const canManageOffers =
    !isPreview &&
    currentUserId === job.customer_id &&
    job.status === "open";

  const myOffer =
    currentUserId && !isOwner
      ? offers.find(
          (offer) =>
            offer.provider_id ===
            currentUserId,
        )
      : undefined;

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
            router.back()
          }
          className="mb-6 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          ← Geri dön
        </button>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-6 py-7 sm:px-8">
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

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900">
                {job.title}
              </h1>

              <p className="mt-3 text-sm text-zinc-500">
                İlan tarihi:{" "}
                {formatDate(
                  job.created_at,
                )}
              </p>

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

              {job.status ===
                "open" &&
                !isOwner &&
                !isPreview &&
                !myOffer && (
                  <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                    <h2 className="text-sm font-semibold text-zinc-900">
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
                          `/jobs/${job.id}/offer`,
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
                        ? "Teklifin bekliyor"
                        : myOffer.status ===
                            "accepted"
                          ? "Teklifin kabul edildi"
                          : "Teklifin reddedildi"}
                    </h2>

                    <p className="mt-2 text-lg font-semibold text-zinc-900">
                      {formatPrice(
                        myOffer.price,
                      )}
                    </p>

                    {myOffer.message && (
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        {myOffer.message}
                      </p>
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

              {isOwner &&
                !isPreview &&
                job.status ===
                  "in_progress" && (
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
              {job.status === "completed" && (
                <div className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50 p-5">
                  <h2 className="text-sm font-semibold text-emerald-900">
                    Bu iş tamamlandı
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-emerald-700">
                    İlan kapanmış durumda. Yeni teklif
                    alınmıyor.
                  </p>
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

                      const isProcessing =
                        processingOfferId ===
                        offer.id;

                      return (
                        <div
                          key={offer.id}
                          className="rounded-xl border border-zinc-200 p-4"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/providers/${offer.provider_id}`,
                              )
                            }
                            className="text-left text-sm font-semibold text-zinc-900 hover:underline"
                          >
                            {provider?.full_name?.trim() ||
                              "İsimsiz Uzman"}
                          </button>

                          <p className="mt-2 text-lg font-semibold text-zinc-900">
                            {formatPrice(
                              offer.price,
                            )}
                          </p>

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
                              <div className="mt-4 flex flex-wrap gap-2">
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
                            )}
                        </div>
                      );
                    },
                  )
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}