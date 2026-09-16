"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getPreviewUser, type PreviewUser } from "@/lib/preview";

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
    title: string;
    description: string;
    budget: number | null;
    city: string | null;
    location_type: "remote" | "on_site" | "hybrid";
    deadline: string | null;
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
    return "bg-green-100 text-green-700";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700";
  }

  return "bg-yellow-100 text-yellow-700";
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
    return "Açık";
  }

  if (status === "closed") {
    return "Kapalı";
  }

  if (status === "in_progress") {
    return "Devam ediyor";
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
  const [previewUser, setPreviewUser] =
    useState<PreviewUser | null>(null);

  async function handleOpenConversation(jobId: number) {
    setErrorMessage("");

    const { data, error } = await supabase.rpc(
      "get_or_create_conversation",
      {
        p_job_id: jobId,
      },
    );

    if (error) {
      setErrorMessage(
        error.message ||
          "Mesajlaşma başlatılırken bir hata oluştu.",
      );
      return;
    }

    const conversationId = Number(data);

    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      setErrorMessage("Sohbet oluşturulamadı.");
      return;
    }

    router.push(`/messages/${conversationId}`);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadOffers() {
      const supabase = createClient();

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
            setErrorMessage(
              "Teklifler yüklenirken bir hata oluştu.",
            );
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
            deadline: row.job_deadline,
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
          setOffers(normalizedOffers);
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
          setErrorMessage(
            "Teklifler yüklenirken bir hata oluştu.",
          );
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
          deadline: row.job_deadline,
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
        setOffers(normalizedOffers);
        setLoading(false);
      }
    }

    loadOffers();

    return () => {
      cancelled = true;
    };
  }, [router]);

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
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {offers.length === 0 ? (
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

              return (
                <article
                  key={offer.id}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {job.service?.category && (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                              {job.service.category.name}
                            </span>
                          )}

                          {job.service && (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                              {job.service.name}
                            </span>
                          )}
                        </div>

                        <h2 className="text-xl font-semibold text-gray-900">
                          {job.title}
                        </h2>
                      </div>

                      <span
                        className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${getOfferStatusClass(
                          offer.status,
                        )}`}
                      >
                        {getOfferStatusLabel(offer.status)}
                      </span>
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600">
                      {job.description}
                    </p>

                    <div className="grid grid-cols-1 gap-4 border-y border-gray-100 py-5 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <div className="text-xs font-medium text-gray-400">
                          Teklifim
                        </div>

                        <div className="mt-1 font-semibold text-gray-900">
                          {formatPrice(offer.price)}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-medium text-gray-400">
                          İş bütçesi
                        </div>

                        <div className="mt-1 font-semibold text-gray-900">
                          {formatPrice(job.budget)}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-medium text-gray-400">
                          Çalışma şekli
                        </div>

                        <div className="mt-1 font-semibold text-gray-900">
                          {getLocationLabel(
                            job.location_type,
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-medium text-gray-400">
                          Konum
                        </div>

                        <div className="mt-1 font-semibold text-gray-900">
                          {job.city || "Belirtilmedi"}
                        </div>
                      </div>
                    </div>

                    {offer.message && (
                      <div className="rounded-xl bg-gray-50 p-4">
                        <div className="text-xs font-semibold text-gray-400">
                          Teklif mesajım
                        </div>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {offer.message}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        Teklif tarihi:{" "}
                        <span className="font-medium text-gray-700">
                          {formatDate(offer.created_at)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span>
                          Son tarih:{" "}
                          <span className="font-medium text-gray-700">
                            {formatDate(job.deadline)}
                          </span>
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getJobStatusClass(
                            job.status,
                          )}`}
                        >
                          İş: {getJobStatusLabel(job.status)}
                        </span>
                      </div>
                    </div>

                    {offer.status === "accepted" &&
                      job.status === "in_progress" && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                          Teklifin kabul edildi. İş şu anda devam
                          ediyor.
                        </div>
                      )}

                    {offer.status === "accepted" &&
                      job.status === "completed" && (
                        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                          Bu iş tamamlandı.
                        </div>
                      )}

                    {offer.status === "accepted" &&
                      (job.status === "in_progress" ||
                        job.status === "completed") && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenConversation(job.id)
                          }
                          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
                        >
                          Mesajlaş
                        </button>
                      )}
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