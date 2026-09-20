"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getPreviewUser } from "@/lib/preview";
import { ensureCanonicalJobRoute } from "@/lib/jobs/public-id";

type Job = {
  id: number;
  public_id: string;
  customer_id: string;
  title: string;
  description: string | null;
  budget: number | null;
  city: string | null;
  location_type: "remote" | "on_site" | "hybrid";
  status: "open" | "in_progress" | "completed";
  service_name: string | null;
};

export default function JobOfferPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  const jobId =
    typeof params.id === "string"
      ? params.id
      : "";

  const [job, setJob] =
    useState<Job | null>(null);

  const [price, setPrice] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [previewMode, setPreviewMode] =
    useState(false);

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [alreadyOffered, setAlreadyOffered] =
    useState(false);

  useEffect(() => {
    const previewUser = getPreviewUser();

    if (previewUser) {
      setPreviewMode(true);
    }
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

    const resolved = await ensureCanonicalJobRoute(
      supabase,
      jobId,
      router,
      "/offer",
    );

    if (resolved.status === "redirect") {
      return;
    }

    if (resolved.status === "missing") {
      setError("Bu içeriğe şu an erişilemiyor.");
      setLoading(false);
      return;
    }

    const { data, error } =
      await supabase.rpc(
        "get_job_for_offer",
        {
          p_job_id: resolved.id,
        },
      );

    const jobRow = Array.isArray(data)
      ? data[0]
      : data;

    if (error || !jobRow) {
      console.error(
        "Job offer page error:",
        error,
      );

      setError("Bu içeriğe şu an erişilemiyor.");

      setLoading(false);
      return;
    }

    setJob({
      id: jobRow.id,
      public_id: resolved.publicId,
      customer_id: jobRow.customer_id,
      title: jobRow.title,
      description:
        jobRow.description,
      budget: jobRow.budget,
      city: jobRow.city,
      location_type:
        jobRow.location_type,
      status:
        jobRow.status,
      service_name:
        jobRow.service_name ?? null,
    });

    const {
      data: userData,
    } = await supabase.auth.getUser();

    const userId =
      userData.user?.id ?? null;

    setCurrentUserId(userId);

    if (
      jobRow.status !== "open" &&
      jobRow.customer_id !== userId
    ) {
      setJob(null);
      setError("Bu içeriğe şu an erişilemiyor.");
      setLoading(false);
      return;
    }

    if (userId) {
      const { data: existingOffer } =
        await supabase
          .from("offers")
          .select("id")
          .eq("job_id", jobRow.id)
          .eq("provider_id", userId)
          .maybeSingle();

      setAlreadyOffered(
        existingOffer !== null,
      );
    } else {
      setAlreadyOffered(false);
    }

    setLoading(false);
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

  function getLocationLabel() {
    if (!job) {
      return "-";
    }

    if (job.location_type === "remote") {
      return "Uzaktan";
    }

    if (
      job.location_type === "on_site"
    ) {
      return "Yerinde";
    }

    return "Uzaktan + Yerinde";
  }

  async function submitOffer(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (previewMode) {
      setError(
        "Önizleme modunda teklif gönderilemez.",
      );
      return;
    }

    const numericPrice = Number(
      price.replace(/\./g, "").replace(",", "."),
    );

    if (
      !price.trim() ||
      !Number.isFinite(numericPrice) ||
      numericPrice < 0
    ) {
      setError(
        "Geçerli bir teklif tutarı gir.",
      );
      return;
    }

    if (numericPrice === 0) {
      setError(
        "Teklif tutarı 0 TL olamaz.",
      );
      return;
    }

    if (!job) {
      setError("Bu içeriğe şu an erişilemiyor.");
      return;
    }

    if (job.status !== "open") {
      setError(
        "Bu ilan artık teklif almıyor.",
      );
      return;
    }

    if (alreadyOffered) {
      setError("Bu ilana zaten teklif verdin.");
      return;
    }

    setSubmitting(true);

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setError(
        "Teklif göndermek için giriş yapmalısın.",
      );

      setSubmitting(false);
      return;
    }

    const { data: providerProfile } =
      await supabase
        .from("provider_profiles")
        .select("user_id")
        .eq(
          "user_id",
          userData.user.id,
        )
        .maybeSingle();

    if (!providerProfile) {
      setError(
        "Teklif gönderebilmek için uzman profilini tamamlamalısın.",
      );

      setSubmitting(false);
      return;
    }

    const { error: offerError } =
      await supabase
        .from("offers")
        .insert({
          job_id: job.id,
          provider_id:
            userData.user.id,
          price: numericPrice,
          message:
            message.trim() || null,
        });

    if (offerError) {
      console.error(
        "Offer insert error:",
        offerError,
      );

      if (
        offerError.code ===
        "23505"
      ) {
        setError(
          "Bu ilana zaten teklif verdin.",
        );
      } else {
        setError(
          "Teklif gönderilirken bir hata oluştu.",
        );
      }

      setSubmitting(false);
      return;
    }

    setSuccess(
      "Teklifin başarıyla gönderildi.",
    );

    setSubmitting(false);

    setTimeout(() => {
      router.push(
        `/jobs/${job.public_id}`,
      );
    }, 900);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-zinc-500">
            İlan yükleniyor...
          </p>
        </div>
      </main>
    );
  }

  if (error && !job) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-6 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
          >
            ← Geri dön
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm text-red-700">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/jobs")}
            className="mt-6 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
          >
            İşler’e dön
          </button>
        </div>
      </main>
    );
  }

  if (!job) {
    return null;
  }

  const isOwnJob =
    currentUserId !== null &&
    job.customer_id === currentUserId;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        {previewMode && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Admin önizleme modu
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            router.push(
              `/jobs/${job.public_id}`,
            )
          }
          className="mb-6 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          ← İlana dön
        </button>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <aside className="lg:col-start-2 lg:row-start-1">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-900">
                Proje Özeti
              </h2>

              <div className="mt-5 flex flex-col gap-5">
                <div className="lg:hidden">
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    {job.title}
                  </h1>
                </div>

                {job.description ? (
                  <div>
                    <p className="text-xs text-zinc-400">
                      Açıklama
                    </p>

                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                      {job.description}
                    </p>
                  </div>
                ) : null}

                {job.service_name ? (
                  <div className="lg:hidden">
                    <p className="text-xs text-zinc-400">
                      Hizmet
                    </p>

                    <div className="mt-2">
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700">
                        {job.service_name}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="lg:order-2">
                  <p className="text-xs text-zinc-400">
                    Çalışma şekli
                  </p>

                  <p className="mt-1 text-sm font-medium text-zinc-800">
                    {getLocationLabel()}
                  </p>
                </div>

                {job.city ? (
                  <div className="lg:order-3">
                    <p className="text-xs text-zinc-400">
                      Şehir
                    </p>

                    <p className="mt-1 text-sm font-medium text-zinc-800">
                      {job.city}
                    </p>
                  </div>
                ) : null}

                <div className="max-lg:order-last lg:order-1">
                  <p className="text-xs text-zinc-400">
                    Bütçe
                  </p>

                  <p className="mt-1 text-base font-semibold text-zinc-900">
                    {formatPrice(
                      job.budget,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm lg:col-start-1 lg:row-start-1 lg:row-span-2">
            <div className="border-b border-zinc-100 px-6 py-7 sm:px-8">
              <p className="text-sm font-medium text-zinc-500">
                Teklif Ver
              </p>

              <h1 className="mt-2 hidden text-2xl font-semibold tracking-tight text-zinc-900 lg:block">
                {job.title}
              </h1>

              {job.service_name && (
                <div className="mt-4 hidden lg:block">
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700">
                    {job.service_name}
                  </span>
                </div>
              )}
            </div>

            {isOwnJob ? (
              <div className="px-6 py-7 sm:px-8">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <p className="text-sm text-zinc-700">
                    Kendi ilanına teklif veremezsin.
                  </p>
                </div>
              </div>
            ) : alreadyOffered ? (
              <div className="px-6 py-7 sm:px-8">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <p className="text-sm text-zinc-700">
                    Bu ilana zaten teklif verdin.
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    Bu projeye tekrar teklif veremezsin.
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/jobs/${job.public_id}`,
                      )
                    }
                    className="rounded-xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    İlana dön
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      router.push("/my-offers")
                    }
                    className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
                  >
                    Tekliflerim
                  </button>
                </div>
              </div>
            ) : job.status !== "open" ? (
              <div className="px-6 py-7 sm:px-8">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <p className="text-sm text-zinc-700">
                    Bu ilan artık teklif almıyor.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/jobs/${job.public_id}`,
                    )
                  }
                  className="mt-6 rounded-xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  İlana dön
                </button>
              </div>
            ) : (
            <form
              onSubmit={submitOffer}
              className="px-6 py-7 sm:px-8"
            >
              <div>
                <label
                  htmlFor="price"
                  className="text-sm font-semibold text-zinc-900"
                >
                  Teklif tutarın
                </label>

                <div className="mt-2 relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                    ₺
                  </span>

                  <input
                    id="price"
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onChange={(event) =>
                      setPrice(
                        event.target.value,
                      )
                    }
                    placeholder="Örn. 8.500"
                    disabled={submitting}
                    className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-9 pr-4 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50"
                  />
                </div>

                <p className="mt-2 text-xs text-zinc-400">
                  Proje sahibi tarafından belirtilen bütçe:{" "}
                  {formatPrice(job.budget)}
                </p>

                {job.budget !== null ? (
                  <p className="mt-1 text-xs text-zinc-400">
                    Bu bir tavan değildir; kendi teklif tutarını
                    yazabilirsin.
                  </p>
                ) : null}
              </div>

              <div className="mt-6">
                <label
                  htmlFor="message"
                  className="text-sm font-semibold text-zinc-900"
                >
                  Teklif mesajın
                </label>

                <textarea
                  id="message"
                  value={message}
                  onChange={(event) =>
                    setMessage(
                      event.target.value,
                    )
                  }
                  placeholder="Proje hakkında kısa bir açıklama, çalışma şeklin veya teslim süren hakkında bilgi verebilirsin."
                  rows={7}
                  disabled={submitting}
                  className="mt-2 w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50"
                />

                <p className="mt-2 text-xs text-zinc-400">
                  Kısa ve net bir mesaj yeterli.
                </p>
              </div>

              {error && (
                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">
                    {error}
                  </p>
                </div>
              )}

              {success && (
                <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                  <p className="text-sm text-green-700">
                    {success}
                  </p>
                </div>
              )}

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/jobs/${job.public_id}`,
                    )
                  }
                  disabled={submitting}
                  className="rounded-xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  Vazgeç
                </button>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    previewMode ||
                    job.status !== "open"
                  }
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "Gönderiliyor..."
                    : "Teklifi Gönder"}
                </button>
              </div>
            </form>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 lg:col-start-2 lg:row-start-2">
            <h2 className="text-sm font-semibold text-zinc-900">
              Teklif verirken
            </h2>

            <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-500">
              <li>
                • Teklif tutarını net belirt.
              </li>

              <li>
                • Projeyi nasıl ele alacağını kısaca anlat.
              </li>

              <li>
                • Teslim süresi veya çalışma koşullarını gerekiyorsa belirt.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}