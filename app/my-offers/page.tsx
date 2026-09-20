"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getPreviewUser, type PreviewUser } from "@/lib/preview";
import { getJobPublicIdMap } from "@/lib/jobs/public-id";
import { openMessagesDockConversation } from "@/components/MessagesDock";
import { ProjectTimeline } from "@/components/ProjectTimeline";

type OfferStatus = "pending" | "accepted" | "rejected";

type Offer = {
  id: number;
  job_id: number;
  provider_id: string;
  price: number;
  message: string | null;
  status: OfferStatus;
  created_at: string;
  job: {
    id: number;
    public_id?: string | null;
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
    service: {
      id: number;
      name: string;
      category: {
        id: number;
        name: string;
      } | null;
    } | null;
  } | null;
};

type PreviewOfferRow = {
  id: number;
  job_id: number;
  provider_id: string;
  price: number;
  message: string | null;
  status: OfferStatus;
  created_at: string;
  job_title: string;
  job_description: string;
  job_budget: number | null;
  job_city: string | null;
  job_location_type: "remote" | "on_site" | "hybrid";
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
};

function formatDate(value: string | null) {
  if (!value) {
    return "Belirtilmedi";
  }

  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatPrice(value: number | null) {
  if (value === null || value === undefined) {
    return "Belirtilmedi";
  }

  return `${new Intl.NumberFormat("tr-TR").format(value)} TL`;
}

function getLocationLabel(
  locationType: "remote" | "on_site" | "hybrid",
) {
  if (locationType === "remote") {
    return "Uzaktan";
  }

  if (locationType === "on_site") {
    return "Yerinde";
  }

  return "Hibrit";
}

function getOfferStatusLabel(status: OfferStatus) {
  if (status === "accepted") {
    return "Kabul edildi";
  }

  if (status === "rejected") {
    return "Reddedildi";
  }

  return "Bekliyor";
}

function getOfferStatusClass(status: OfferStatus) {
  if (status === "accepted") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "rejected") {
    return "bg-red-50 text-red-700";
  }

  return "bg-amber-50 text-amber-700";
}

function excerptText(value: string, maxLength = 140) {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

function getJobStatusLabel(
  status:
    | "open"
    | "closed"
    | "in_progress"
    | "completed"
    | "cancelled",
) {
  if (status === "open") {
    return "İlan açık";
  }

  if (status === "closed") {
    return "Kapandı";
  }

  if (status === "in_progress") {
    return "İş devam ediyor";
  }

  if (status === "completed") {
    return "Tamamlandı";
  }

  return "İptal edildi";
}

function getJobStatusClass(
  status:
    | "open"
    | "closed"
    | "in_progress"
    | "completed"
    | "cancelled",
) {
  if (status === "completed") {
    return "bg-green-100 text-green-700";
  }

  if (status === "in_progress") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "cancelled") {
    return "bg-red-100 text-red-700";
  }

  if (status === "closed") {
    return "bg-gray-100 text-gray-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

export default function MyOffersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [previewUser, setPreviewUser] =
    useState<PreviewUser | null>(null);
  const [reviewedJobIds, setReviewedJobIds] = useState<
    Record<number, true>
  >({});

  async function handleOpenConversation(jobId: number) {
    setErrorMessage("");

    const { data, error } = await supabase.rpc(
      "get_or_create_conversation",
      {
        p_job_id: jobId,
      },
    );

    if (error) {
      console.error(error);
      setErrorMessage("Bir hata oluştu. Lütfen tekrar deneyin.");
      return;
    }

    const conversationId = Number(data);

    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      setErrorMessage("Sohbet oluşturulamadı.");
      return;
    }

    openMessagesDockConversation(conversationId, jobId);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadOffers() {
      const supabase = createClient();
      setLoading(true);
      setErrorMessage("");

      const currentPreviewUser = getPreviewUser();

      if (!cancelled) {
        setPreviewUser(currentPreviewUser);
      }

      if (currentPreviewUser) {
        const { data, error } = await supabase.rpc(
          "admin_preview_provider_offers",
          {
            p_user_id: currentPreviewUser.id,
          },
        );

        if (error) {
          console.error(error);

          if (!cancelled) {
            setErrorMessage("Bir hata oluştu. Lütfen tekrar deneyin.");
            setLoading(false);
          }

          return;
        }

        const rows = (data ?? []) as PreviewOfferRow[];

        const normalizedOffers: Offer[] = rows.map((row) => ({
          id: row.id,
          job_id: row.job_id,
          provider_id: row.provider_id,
          price: row.price,
          message: row.message,
          status: row.status,
          created_at: row.created_at,
          job: {
            id: row.job_id,
            title: row.job_title,
            description: row.job_description,
            budget: row.job_budget,
            city: row.job_city,
            location_type: row.job_location_type,
            status: row.job_status,
            created_at: row.job_created_at,
            service: row.service_id
              ? {
                  id: row.service_id,
                  name: row.service_name ?? "",
                  category: row.category_id
                    ? {
                        id: row.category_id,
                        name: row.category_name ?? "",
                      }
                    : null,
                }
              : null,
          },
        }));

        if (!cancelled) {
          const publicIds = await getJobPublicIdMap(
            supabase,
            normalizedOffers
              .map((offer) => offer.job?.id)
              .filter((id): id is number => typeof id === "number"),
          );

          setOffers(
            normalizedOffers.map((offer) =>
              offer.job
                ? {
                    ...offer,
                    job: {
                      ...offer.job,
                      public_id: publicIds.get(offer.job.id) ?? null,
                    },
                  }
                : offer,
            ),
          );
          setReviewedJobIds({});
          setLoading(false);
        }

        return;
      }

      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const {
        data,
        error: offersError,
      } = await supabase.rpc(
        "provider_get_my_offers",
      );

      if (offersError) {
        console.error(offersError);

        if (!cancelled) {
          setErrorMessage("Bir hata oluştu. Lütfen tekrar deneyin.");
          setLoading(false);
        }

        return;
      }

      const rows = (data ?? []) as PreviewOfferRow[];

      const normalizedOffers: Offer[] = rows.map((row) => ({
        id: row.id,
        job_id: row.job_id,
        provider_id: row.provider_id,
        price: row.price,
        message: row.message,
        status: row.status,
        created_at: row.created_at,
        job: {
          id: row.job_id,
          title: row.job_title,
          description: row.job_description,
          budget: row.job_budget,
          city: row.job_city,
          location_type: row.job_location_type,
          status: row.job_status,
          created_at: row.job_created_at,
          service: row.service_id
            ? {
                id: row.service_id,
                name: row.service_name ?? "",
                category: row.category_id
                  ? {
                      id: row.category_id,
                      name: row.category_name ?? "",
                    }
                  : null,
              }
            : null,
        },
      }));

      const completedAcceptedJobIds = normalizedOffers
        .filter(
          (offer) =>
            offer.status === "accepted" &&
            offer.job?.status === "completed",
        )
        .map((offer) => offer.job_id);

      let nextReviewed: Record<number, true> = {};

      if (completedAcceptedJobIds.length > 0) {
        const { data: reviewRows, error: reviewsError } =
          await supabase
            .from("reviews")
            .select("job_id")
            .eq("reviewer_id", user.id)
            .in("job_id", completedAcceptedJobIds);

        if (reviewsError) {
          console.error(reviewsError);
        } else {
          for (const row of reviewRows ?? []) {
            nextReviewed[Number(row.job_id)] = true;
          }
        }
      }

      if (!cancelled) {
        const publicIds = await getJobPublicIdMap(
          supabase,
          normalizedOffers
            .map((offer) => offer.job?.id)
            .filter((id): id is number => typeof id === "number"),
        );

        if (!cancelled) {
          setOffers(
            normalizedOffers.map((offer) =>
              offer.job
                ? {
                    ...offer,
                    job: {
                      ...offer.job,
                      public_id: publicIds.get(offer.job.id) ?? null,
                    },
                  }
                : offer,
            ),
          );
          setReviewedJobIds(nextReviewed);
          setLoading(false);
        }
      }
    }

    loadOffers();

    return () => {
      cancelled = true;
    };
  }, [router, retryToken]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
            Teklifler yükleniyor...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        {previewUser && (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold text-amber-800">
                Kullanıcı önizlemesi aktif
              </div>

              <div className="text-sm text-amber-700">
                Bu sayfadaki teklifler seçilen uzman hesabına göre
                gösteriliyor.
              </div>

              <div className="mt-1 text-xs text-amber-600">
                {previewUser.full_name || "İsimsiz kullanıcı"}
                {" · "}
                {previewUser.email || "E-posta yok"}
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mb-4 text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            ← Ana sayfa
          </button>

          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Tekliflerim
          </h1>

          <p className="mt-2 text-gray-600">
            Gönderdiğin teklifleri ve teklif durumlarını buradan
            takip edebilirsin.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="text-sm text-red-700">{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                setRetryToken((current) => current + 1);
              }}
              className="text-sm font-medium text-red-800 underline-offset-2 hover:underline"
            >
              Tekrar dene
            </button>
          </div>
        )}

        {!errorMessage && offers.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Henüz teklifin yok
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Sana uygun işleri inceleyerek ilk teklifini
              gönderebilirsin.
            </p>

            {!previewUser && (
              <button
                type="button"
                onClick={() => router.push("/jobs")}
                className="mt-6 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                İşleri Gör
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {offers.map((offer) => {
              const job = offer.job;

              if (!job) {
                return null;
              }

              const isRejected = offer.status === "rejected";
              const locationLine = [
                getLocationLabel(job.location_type),
                job.city?.trim() || "Konum belirtilmedi",
              ].join(" · ");

              return (
                <article
                  key={offer.id}
                  className={
                    isRejected
                      ? "rounded-2xl border border-zinc-100 bg-white p-5"
                      : "rounded-2xl border border-zinc-200 bg-white p-5"
                  }
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {job.service?.category && (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                          {job.service.category.name}
                        </span>
                      )}

                      {job.service && (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                          {job.service.name}
                        </span>
                      )}

                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getOfferStatusClass(
                          offer.status,
                        )}`}
                      >
                        {getOfferStatusLabel(offer.status)}
                      </span>

                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getJobStatusClass(
                          job.status,
                        )}`}
                      >
                        {getJobStatusLabel(job.status)}
                      </span>
                    </div>

                    <h2 className="text-lg font-semibold text-zinc-900">
                      {job.title}
                    </h2>

                    <p
                      className={`line-clamp-3 text-sm leading-6 ${
                        isRejected ? "text-zinc-500" : "text-zinc-600"
                      }`}
                    >
                      {job.description}
                    </p>

                    <p
                      className={`text-sm font-medium ${
                        isRejected ? "text-zinc-600" : "text-zinc-800"
                      }`}
                    >
                      {`Teklifim ${formatPrice(offer.price)} · İş bütçesi ${formatPrice(job.budget)}`}
                    </p>

                    <p
                      className={`text-sm ${
                        isRejected ? "text-zinc-400" : "text-zinc-500"
                      }`}
                    >
                      {locationLine}
                    </p>

                    <ProjectTimeline
                      jobStatus={job.status}
                      pendingOfferCount={
                        offer.status === "pending" ? 1 : 0
                      }
                    />

                    {offer.message ? (
                      <p
                        className={`text-sm leading-6 ${
                          isRejected ? "text-zinc-400" : "text-zinc-500"
                        }`}
                      >
                        {excerptText(offer.message)}
                      </p>
                    ) : null}

                    <p className="text-xs text-zinc-400">
                      {formatDate(offer.created_at)}
                    </p>

                    {offer.status === "pending" ? (
                      <p className="text-sm text-zinc-500">
                        Teklifiniz müşterinin yanıtını bekliyor.
                      </p>
                    ) : null}

                    {offer.status === "accepted" ? (
                      <>
                        <p className="text-sm font-medium text-zinc-700">
                          {job.status === "completed"
                            ? "İş tamamlandı."
                            : "İş başladı. Müşteriyle iletişime geçebilirsiniz."}
                        </p>

                        {job.status === "in_progress" ? (
                          <p className="text-sm text-zinc-500">
                            İş, tamamlandı olarak işaretlenene kadar devam eder.
                          </p>
                        ) : null}
                      </>
                    ) : null}

                    {offer.status === "rejected" ? (
                      <>
                        <p className="text-sm text-zinc-500">
                          Bu teklif reddedildi.
                        </p>

                        {job.status === "open" ? (
                          <p className="text-sm text-zinc-500">
                            Proje hâlâ açık, ancak bu ilana tekrar teklif
                            veremezsin.
                          </p>
                        ) : (
                          <p className="text-sm text-zinc-500">
                            Teklifin reddedildi ve proje artık açık değil.
                          </p>
                        )}
                      </>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {job.status === "open" ||
                      offer.status === "accepted" ? (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/jobs/${job.public_id || job.id}`,
                            )
                          }
                          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                        >
                          Projeyi Gör
                        </button>
                      ) : null}

                      {offer.status === "accepted" ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenConversation(job.id)
                          }
                          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                        >
                          Mesajlaş
                        </button>
                      ) : null}

                      {!previewUser &&
                      offer.status === "accepted" &&
                      job.status === "completed" &&
                      !reviewedJobIds[job.id] ? (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/jobs/${job.public_id || job.id}/review`,
                            )
                          }
                          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                        >
                          Değerlendir
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}