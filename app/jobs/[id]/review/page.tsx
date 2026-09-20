"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getPreviewUser } from "@/lib/preview";
import { ensureCanonicalJobRoute } from "@/lib/jobs/public-id";

type Job = {
  id: number;
  title: string;
  status: "open" | "in_progress" | "completed";
  customer_id: string;
};

type Offer = {
  id: number;
  provider_id: string;
  status: "pending" | "accepted" | "rejected";
};

type ExistingReview = {
  rating: number;
  comment: string | null;
};

type CounterpartReview = {
  rating: number;
  comment: string | null;
};

export default function JobReviewPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  const jobId =
    typeof params.id === "string" ? params.id : "";

  const [job, setJob] = useState<Job | null>(null);
  const [acceptedOffer, setAcceptedOffer] =
    useState<Offer | null>(null);
  const [providerName, setProviderName] = useState("Uzman");
  const [existingReview, setExistingReview] =
    useState<ExistingReview | null>(null);
  const [counterpartReview, setCounterpartReview] =
    useState<CounterpartReview | null>(null);

  const [currentUserId, setCurrentUserId] = useState<
    string | null
  >(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reviewRating, setReviewRating] = useState<
    number | null
  >(null);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] =
    useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewToast, setReviewToast] = useState<
    string | null
  >(null);

  const [previewUser, setPreviewUser] = useState<
    ReturnType<typeof getPreviewUser>
  >(null);
  const [completionKind, setCompletionKind] = useState<
    "submitted" | "skipped" | null
  >(null);

  useEffect(() => {
    setPreviewUser(getPreviewUser());
  }, []);

  useEffect(() => {
    if (!jobId) {
      setError("İlan bulunamadı.");
      setLoading(false);
      return;
    }

    loadReviewPage();
  }, [jobId]);

  useEffect(() => {
    if (!reviewToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setReviewToast(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [reviewToast]);

  async function loadReviewPage() {
    setLoading(true);
    setError("");
    setCounterpartReview(null);
    setCompletionKind(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const currentPreviewUser = getPreviewUser();
    const viewerId =
      currentPreviewUser?.id ?? user?.id ?? null;

    setCurrentUserId(viewerId);

    if (!viewerId) {
      setError("Giriş yapmalısın.");
      setLoading(false);
      return;
    }

    const resolved = await ensureCanonicalJobRoute(
      supabase,
      jobId,
      router,
      "/review",
    );

    if (resolved.status === "redirect") {
      return;
    }

    if (resolved.status === "missing") {
      setError("Bu ilan görüntülenemiyor.");
      setLoading(false);
      return;
    }

    const { data, error: jobError } = await supabase.rpc(
      "get_job_for_offer",
      {
        p_job_id: resolved.id,
      },
    );

    const jobRow = Array.isArray(data) ? data[0] : data;

    if (jobError || !jobRow) {
      console.error("Job review load error:", jobError);
      setError("Bu ilan görüntülenemiyor.");
      setLoading(false);
      return;
    }

    const normalizedJob: Job = {
      id: jobRow.id,
      title: jobRow.title,
      status: jobRow.status,
      customer_id: jobRow.customer_id,
    };

    setJob(normalizedJob);

    const { data: offersData, error: offersError } =
      await supabase
        .from("offers")
        .select("id, provider_id, status")
        .eq("job_id", normalizedJob.id);

    if (offersError) {
      console.error("Review accepted offer error:", offersError);
      setError("Uzman bilgisi yüklenirken bir hata oluştu.");
      setLoading(false);
      return;
    }

    const accepted =
      ((offersData ?? []) as Offer[]).find(
        (offer) => offer.status === "accepted",
      ) ?? null;

    setAcceptedOffer(accepted);

    const isCustomer = viewerId === normalizedJob.customer_id;
    const isAcceptedProvider =
      accepted != null && accepted.provider_id === viewerId;

    if (!isCustomer && !isAcceptedProvider) {
      setError("Bu değerlendirme sayfasına erişim yetkin yok.");
      setLoading(false);
      return;
    }

    if (accepted && isCustomer) {
      const { data: providerData, error: providerError } =
        await supabase.rpc("customer_get_provider_profiles", {
          p_provider_ids: [accepted.provider_id],
        });

      if (providerError) {
        console.error(
          "Provider profiles error:",
          providerError,
        );
      }

      const providerRows = (
        Array.isArray(providerData)
          ? providerData
          : providerData
            ? [providerData]
            : []
      ) as Array<{
        user_id?: string;
        provider_id?: string;
        full_name: string | null;
      }>;

      const providerRow =
        providerRows.find((provider) => {
          const providerUserId =
            provider.user_id ?? provider.provider_id;
          return providerUserId === accepted.provider_id;
        }) ?? providerRows[0];

      const name =
        typeof providerRow?.full_name === "string"
          ? providerRow.full_name.trim()
          : "";

      setProviderName(name || "İsimsiz Uzman");
    }

    if (normalizedJob.status === "completed") {
      const { data: reviewRow, error: reviewLoadError } =
        await supabase
          .from("reviews")
          .select("rating, comment")
          .eq("job_id", normalizedJob.id)
          .eq("reviewer_id", viewerId)
          .maybeSingle();

      if (reviewLoadError) {
        console.error("Review load error:", reviewLoadError);
      }

      if (reviewRow) {
        setExistingReview({
          rating: Number(reviewRow.rating),
          comment:
            typeof reviewRow.comment === "string" &&
            reviewRow.comment.trim()
              ? reviewRow.comment.trim()
              : null,
        });

        const { data: counterpartRow, error: counterpartError } =
          await supabase
            .from("reviews")
            .select("rating, comment, skipped, published_at, reviewer_id")
            .eq("job_id", normalizedJob.id)
            .neq("reviewer_id", viewerId)
            .maybeSingle();

        if (counterpartError) {
          console.error("Counterpart review load error:", counterpartError);
          setCounterpartReview(null);
        } else if (
          counterpartRow &&
          counterpartRow.reviewer_id !== viewerId &&
          counterpartRow.published_at &&
          counterpartRow.skipped === false
        ) {
          const counterpartRating = Number(counterpartRow.rating);

          if (Number.isFinite(counterpartRating) && counterpartRating >= 1) {
            setCounterpartReview({
              rating: counterpartRating,
              comment:
                typeof counterpartRow.comment === "string" &&
                counterpartRow.comment.trim()
                  ? counterpartRow.comment.trim()
                  : null,
            });
          } else {
            setCounterpartReview(null);
          }
        } else {
          setCounterpartReview(null);
        }
      } else {
        setExistingReview(null);
        setCounterpartReview(null);
      }
    }

    setLoading(false);
  }

  async function handleSubmitReview() {
    if (previewUser || !job || !currentUserId || !acceptedOffer) {
      return;
    }

    if (
      (
        currentUserId !== job.customer_id &&
        currentUserId !== acceptedOffer.provider_id
      ) ||
      job.status !== "completed"
    ) {
      return;
    }

    if (!reviewRating) {
      setReviewError("Lütfen bir puan seç.");
      setReviewToast("Lütfen bir puan seç.");
      return;
    }

    setSubmittingReview(true);
    setReviewError("");

    const { error: submitError } = await supabase.rpc(
      "submit_review",
      {
        p_job_id: job.id,
        p_rating: reviewRating,
        p_comment: reviewComment.trim() || null,
        p_criteria: null,
      },
    );

    if (submitError) {
      console.error("Review submit error:", submitError);

      setReviewError("Değerlendirme gönderilemedi.");
      setReviewToast("Değerlendirme gönderilemedi.");
      setSubmittingReview(false);
      return;
    }

    setReviewToast("Değerlendirmen gönderildi.");
    setSubmittingReview(false);
    setCompletionKind("submitted");
  }

  async function handleSkipReview() {
    if (previewUser || !job || !currentUserId || !acceptedOffer) {
      return;
    }

    if (
      (
        currentUserId !== job.customer_id &&
        currentUserId !== acceptedOffer.provider_id
      ) ||
      job.status !== "completed"
    ) {
      return;
    }

    setSubmittingReview(true);
    setReviewError("");

    const { error: skipError } = await supabase.rpc(
      "skip_review",
      {
        p_job_id: job.id,
      },
    );

    if (skipError) {
      console.error("Review skip error:", skipError);

      setReviewError("Değerlendirme gönderilemedi.");
      setReviewToast("Değerlendirme gönderilemedi.");
      setSubmittingReview(false);
      return;
    }

    setReviewToast("Değerlendirmen gönderildi.");
    setSubmittingReview(false);
    setCompletionKind("skipped");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-xl">
          <p className="text-sm text-zinc-500">
            Değerlendirme yükleniyor...
          </p>
        </div>
      </main>
    );
  }

  if (error || !job) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={() => router.push("/my-jobs")}
            className="mb-6 text-sm font-medium text-zinc-500 hover:text-zinc-900"
          >
            ← İşlerime dön
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm text-red-700">
              {error || "Değerlendirme sayfası açılamadı."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const isCustomerReviewer =
    currentUserId !== null && currentUserId === job.customer_id;
  const isAcceptedProviderReviewer =
    currentUserId !== null &&
    acceptedOffer != null &&
    currentUserId === acceptedOffer.provider_id;

  const canReview =
    !previewUser &&
    (isCustomerReviewer || isAcceptedProviderReviewer) &&
    job.status === "completed" &&
    Boolean(acceptedOffer);

  const backHref = isAcceptedProviderReviewer && !isCustomerReviewer
    ? "/my-offers"
    : "/my-jobs";

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-xl">
        {completionKind ? null : (
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="mb-6 text-sm font-medium text-zinc-500 hover:text-zinc-900"
        >
          ← İşlerime dön
        </button>
        )}

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          {completionKind ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                {isAcceptedProviderReviewer && !isCustomerReviewer
                  ? "🎉 İş başarıyla tamamlandı!"
                  : "🎉 Tebrikler!"}
              </h1>

              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {isAcceptedProviderReviewer && !isCustomerReviewer
                  ? `“${job.title}” projesi tamamlandı.`
                  : `“${job.title}” projesi başarıyla tamamlandı.`}
              </p>

              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {completionKind === "skipped"
                  ? "Değerlendirme işlemini atladın."
                  : "Değerlendirmen kaydedildi."}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      isAcceptedProviderReviewer && !isCustomerReviewer
                        ? "/my-offers"
                        : "/my-jobs",
                    )
                  }
                  className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  {isAcceptedProviderReviewer && !isCustomerReviewer
                    ? "Tekliflerime Git"
                    : "İşlerime Dön"}
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                >
                  Ana Sayfaya Git
                </button>
              </div>
            </>
          ) : (
            <>
          <p className="text-sm font-medium text-zinc-500">
            {job.title}
          </p>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
            {isAcceptedProviderReviewer && !isCustomerReviewer
              ? "Proje sahibi ile çalışman nasıldı?"
              : `${providerName} ile çalışman nasıldı?`}
          </h1>

          {job.status !== "completed" ? (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Bu iş henüz tamamlanmadığı için değerlendirme
              yapılamaz.
            </p>
          ) : !acceptedOffer ? (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Bu iş için kabul edilmiş bir uzman bulunamadı.
            </p>
          ) : existingReview ? (
            <div className="mt-6">
              <p className="text-sm font-medium text-zinc-800">
                ✓ Bu proje için değerlendirme yaptın.
              </p>

              <p className="mt-3 text-sm text-zinc-600">
                {existingReview.rating >= 1
                  ? `Puanın: ${existingReview.rating}/5`
                  : "Bu işlem kaydedildi."}
              </p>

              {existingReview.comment ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                  {existingReview.comment}
                </p>
              ) : null}

              {counterpartReview ? (
                <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm font-medium text-zinc-800">
                    {isAcceptedProviderReviewer && !isCustomerReviewer
                      ? "Proje sahibinin değerlendirmesi"
                      : "Uzmanın değerlendirmesi"}
                  </p>

                  <p
                    className="mt-2 text-lg leading-none text-zinc-900"
                    aria-label={`${counterpartReview.rating} yıldız`}
                  >
                    {"★".repeat(counterpartReview.rating)}
                    <span className="text-zinc-300">
                      {"★".repeat(5 - counterpartReview.rating)}
                    </span>
                  </p>

                  <p className="mt-2 text-sm text-zinc-600">
                    {`${counterpartReview.rating}/5`}
                  </p>

                  {counterpartReview.comment ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                      {counterpartReview.comment}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : canReview ? (
            <>
              <div className="mt-6 flex flex-wrap gap-1">
                {[1, 2, 3, 4, 5].map((value) => {
                  const selected =
                    reviewRating !== null && value <= reviewRating;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setReviewRating(value);
                        setReviewError("");
                      }}
                      disabled={submittingReview}
                      className={`flex h-12 w-12 items-center justify-center rounded-lg text-3xl leading-none transition disabled:cursor-not-allowed ${
                        selected
                          ? "text-zinc-900"
                          : "text-zinc-300 hover:text-zinc-500"
                      }`}
                      aria-label={`${value} yıldız`}
                      aria-pressed={reviewRating === value}
                    >
                      ★
                    </button>
                  );
                })}
              </div>

              {reviewError ? (
                <p className="mt-2 text-sm text-red-600">
                  {reviewError}
                </p>
              ) : null}

              <label
                htmlFor="reviewComment"
                className="mt-4 block text-sm font-medium text-zinc-900"
              >
                Yorum
                <span className="ml-1 font-normal text-zinc-400">
                  (isteğe bağlı)
                </span>
              </label>

              <textarea
                id="reviewComment"
                name="reviewComment"
                value={reviewComment}
                onChange={(event) =>
                  setReviewComment(event.target.value)
                }
                disabled={submittingReview}
                rows={4}
                placeholder="Deneyimini paylaşmak istersen yazabilirsin."
                className="mt-2 block w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-0 disabled:cursor-not-allowed disabled:bg-zinc-100"
              />

              <button
                type="button"
                onClick={() => handleSubmitReview()}
                disabled={submittingReview || reviewRating === null}
                className="mt-4 w-full rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {submittingReview
                  ? "Gönderiliyor..."
                  : "Değerlendirmeyi Gönder"}
              </button>

              <button
                type="button"
                onClick={() => handleSkipReview()}
                disabled={submittingReview}
                className="mt-3 block text-sm font-medium text-zinc-500 transition hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Değerlendirmeyi atla
              </button>
            </>
          ) : (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Bu iş için değerlendirme yapılamıyor.
            </p>
          )}
            </>
          )}
        </div>
      </div>

      {reviewToast ? (
        <div className="fixed right-4 top-4 z-50 w-[min(calc(100%-2rem),22rem)] rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg">
          <div className="flex items-start gap-3">
            <p className="min-w-0 flex-1 text-sm text-zinc-800">
              {reviewToast}
            </p>

            <button
              type="button"
              onClick={() => setReviewToast(null)}
              className="shrink-0 text-zinc-400 hover:text-zinc-700"
              aria-label="Bildirimi kapat"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
