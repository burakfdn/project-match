"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getPreviewUser } from "@/lib/preview";

type Job = {
  id: number;
  customer_id: string;
  title: string;
  description: string | null;
  budget: number | null;
  city: string | null;
  location_type: "remote" | "on_site" | "hybrid";
  deadline: string | null;
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
      setError("İlan bulunamadı.");
      setLoading(false);
      return;
    }

    console.log("OFFER DEBUG EFFECT", {
      jobId,
      path: window.location.pathname,
    });

    loadJob();
  }, [jobId]);

  async function loadJob() {
    console.log("OFFER DEBUG LOADJOB START", {
      jobId,
      path: window.location.pathname,
    });

    setLoading(true);
    setError("");

    console.log("OFFER DEBUG RPC INPUT", {
      jobId,
      numericJobId: Number(jobId),
    });

    const { data, error } =
      await supabase.rpc(
        "get_job_for_offer",
        {
          p_job_id: Number(jobId),
        },
      );

    console.log("OFFER DEBUG LOADJOB RPC DONE");

    const jobRow = Array.isArray(data)
      ? data[0]
      : data;

    console.log("OFFER DEBUG RPC RESULT", {
      requestedJobId: Number(jobId),
      returnedJobId: jobRow?.id,
      returnedTitle: jobRow?.title,
    });

    if (error || !jobRow) {
      console.error(
        "Job offer page error:",
        error,
      );

      setError(
        "İlan bilgileri yüklenemedi.",
      );

      setLoading(false);
      return;
    }

    setJob({
      id: jobRow.id,
      customer_id: jobRow.customer_id,
      title: jobRow.title,
      description:
        jobRow.description,
      budget: jobRow.budget,
      city: jobRow.city,
      location_type:
        jobRow.location_type,
      deadline:
        jobRow.deadline,
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

  async function submitOffer(
    event: React.FormEvent,
  ) {
    console.log("OFFER DEBUG SUBMIT START", {
      jobId,
      currentJobId: job?.id ?? null,
      currentJobTitle: job?.title ?? null,
    });

    event.preventDefault();

    setError("");
    setSuccess("");

    if (previewMode) {
      console.log("OFFER DEBUG SUBMIT STOPPED", {
        reason: "preview",
      });
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
      console.log("OFFER DEBUG SUBMIT STOPPED", {
        reason: "fiyat geçersiz",
      });
      setError(
        "Geçerli bir teklif tutarı gir.",
      );
      return;
    }

    if (numericPrice === 0) {
      console.log("OFFER DEBUG SUBMIT STOPPED", {
        reason: "fiyat geçersiz",
      });
      setError(
        "Teklif tutarı 0 TL olamaz.",
      );
      return;
    }

    if (!job) {
      console.log("OFFER DEBUG SUBMIT STOPPED", {
        reason: "job yok",
      });
      setError("İlan bulunamadı.");
      return;
    }

    if (job.status !== "open") {
      console.log("OFFER DEBUG SUBMIT STOPPED", {
        reason: "status !== open",
      });
      setError(
        "Bu ilan artık teklif almıyor.",
      );
      return;
    }

    if (alreadyOffered) {
      console.log("OFFER DEBUG SUBMIT STOPPED", {
        reason: "alreadyOffered",
      });
      setError("Bu ilana zaten teklif verdin.");
      return;
    }

    setSubmitting(true);

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      console.log("OFFER DEBUG SUBMIT STOPPED", {
        reason: "kullanıcı yok",
      });
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
      console.log("OFFER DEBUG SUBMIT STOPPED", {
        reason: "provider profile yok",
      });
      setError(
        "Teklif gönderebilmek için uzman profilini tamamlamalısın.",
      );

      setSubmitting(false);
      return;
    }

    console.log("OFFER DEBUG INSERT", {
      urlJobId: jobId,
      stateJobId: job?.id,
      stateJobTitle: job?.title,
      insertJobId: job?.id,
      providerId: userData.user.id,
    });

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

    console.log("OFFER DEBUG INSERT RESULT", {
      error: offerError,
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
        `/jobs/${job.id}`,
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
              `/jobs/${job.id}`,
            )
          }
          className="mb-6 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          ← İlana dön
        </button>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-6 py-7 sm:px-8">
              <p className="text-sm font-medium text-zinc-500">
                Teklif Ver
              </p>

              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
                {job.title}
              </h1>

              {job.service_name && (
                <div className="mt-4">
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
                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/jobs/${job.id}`,
                    )
                  }
                  className="mt-6 rounded-xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  İlana dön
                </button>
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
                      `/jobs/${job.id}`,
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
                      `/jobs/${job.id}`,
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

          <aside>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-zinc-900">
                Proje Özeti
              </h2>

              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-xs text-zinc-400">
                    Bütçe
                  </p>

                  <p className="mt-1 text-base font-semibold text-zinc-900">
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

                <div>
                  <p className="text-xs text-zinc-400">
                    Son tarih
                  </p>

                  <p className="mt-1 text-sm font-medium text-zinc-800">
                    {formatDate(
                      job.deadline,
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
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
          </aside>
        </div>
      </div>
    </main>
  );
}