"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Job = {
  id: number;
  title: string;
  description: string;
  budget: number | null;
  city: string | null;
  location_type: string;
  deadline: string | null;
  status: string;
  category: {
    name: string;
  } | null;
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [successJobId, setSuccessJobId] = useState<number | null>(null);
  const [submittedJobIds, setSubmittedJobIds] = useState<number[]>([]);
  const [submittedOffers, setSubmittedOffers] = useState<
    Record<number, { price: number; status: string }>
  >({});

  async function loadJobs() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Giriş yapmalısın.");
      setLoading(false);
      return;
    }

    // Provider'ın daha önce teklif verdiği işler
    const { data: providerOffers, error: offersError } =
      await supabase
        .from("offers")
        .select("job_id, price, status")
        .eq("provider_id", user.id);

    if (offersError) {
      setError("Tekliflerin yüklenirken bir hata oluştu.");
      setLoading(false);
      return;
    }

    const submittedJobIdsFromDb =
      (providerOffers ?? []).map((offer) => offer.job_id);

    // Açık işler + provider'ın daha önce teklif verdiği işler
    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        title,
        description,
        budget,
        city,
        location_type,
        deadline,
        status,
        category:categories(name)
      `)
      .or(
        submittedJobIdsFromDb.length > 0
          ? `status.eq.open,id.in.(${submittedJobIdsFromDb.join(",")})`
          : "status.eq.open",
      )
      .order("created_at", { ascending: false });

    if (error) {
      setError("Uygun işler yüklenirken bir hata oluştu.");
      setLoading(false);
      return;
    }

    const jobList = (data as unknown as Job[]) ?? [];

    setJobs(jobList);

    setSubmittedJobIds(submittedJobIdsFromDb);

    const offerMap: Record<
      number,
      { price: number; status: string }
    > = {};

    (providerOffers ?? []).forEach((offer) => {
      offerMap[offer.job_id] = {
        price: offer.price,
        status: offer.status,
      };
    });

    setSubmittedOffers(offerMap);
    setLoading(false);
  }

  async function submitOffer(jobId: number) {
    if (!price) {
      setError("Lütfen teklif fiyatını gir.");
      return;
    }

    setSending(true);
    setError(null);

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Giriş yapmalısın.");
      setSending(false);
      return;
    }

    const offerPrice = Number(price);

    const { error } = await supabase.from("offers").insert({
      job_id: jobId,
      provider_id: user.id,
      price: offerPrice,
      message: message || null,
    });

    if (error) {
      if (error.code === "23505") {
        setError("Bu işe daha önce teklif verdin.");
      } else {
        setError("Teklif gönderilirken bir hata oluştu.");
      }

      setSending(false);
      return;
    }

    setSuccessJobId(jobId);

    setSubmittedJobIds((current) =>
      current.includes(jobId) ? current : [...current, jobId],
    );

    setSubmittedOffers((current) => ({
      ...current,
      [jobId]: {
        price: offerPrice,
        status: "pending",
      },
    }));

    setSelectedJobId(null);
    setPrice("");
    setMessage("");
    setSending(false);
  }

  function openOfferForm(jobId: number) {
    setError(null);
    setSuccessJobId(null);
    setSelectedJobId(jobId);
  }

  function closeOfferForm() {
    setSelectedJobId(null);
    setPrice("");
    setMessage("");
    setError(null);
  }

  useEffect(() => {
    loadJobs();
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-zinc-500">
          Uygun işler yükleniyor...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10">
        <p className="text-sm font-medium text-zinc-500">
          Provider Paneli
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Uygun İşler
        </h1>

        <p className="mt-2 text-zinc-500">
          Hizmet kategorilerine uygun açık işleri burada görebilirsin.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center">
          <h2 className="text-lg font-medium">
            Şu anda sana uygun açık iş yok.
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Profilindeki hizmet kategorilerini güncellediğinde daha fazla
            iş görebilirsin.
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          {jobs.map((job) => {
            const submittedOffer = submittedOffers[job.id];

            return (
              <article
                key={job.id}
                className="rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-zinc-300"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                        {job.category?.name ?? "Kategori"}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          job.status === "open"
                            ? "bg-green-50 text-green-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {job.status === "open" ? "Açık" : "Kapandı"}
                      </span>
                    </div>

                    <h2 className="text-xl font-semibold text-zinc-950">
                      {job.title}
                    </h2>

                    <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                      {job.description}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-xl bg-zinc-50 px-5 py-4 sm:min-w-32">
                    <p className="text-xs text-zinc-500">
                      Müşteri bütçesi
                    </p>

                    <p className="mt-1 text-lg font-semibold text-zinc-950">
                      {job.budget
                        ? `${job.budget.toLocaleString("tr-TR")} TL`
                        : "Belirtilmedi"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4 border-t border-zinc-100 pt-5">
                  <div>
                    <p className="text-xs text-zinc-400">
                      Konum
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {job.city ?? "Belirtilmedi"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-400">
                      Çalışma şekli
                    </p>

                    <p className="mt-1 text-sm font-medium">
                      {job.location_type === "remote"
                        ? "Uzaktan"
                        : job.location_type === "on_site"
                          ? "Yerinde"
                          : "Hibrit"}
                    </p>
                  </div>

                  {job.deadline && (
                    <div>
                      <p className="text-xs text-zinc-400">
                        Son tarih
                      </p>

                      <p className="mt-1 text-sm font-medium">
                        {new Date(
                          job.deadline,
                        ).toLocaleDateString("tr-TR")}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-zinc-100 pt-5">
                  {successJobId === job.id ? (
                    <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                      ✓ Teklifin başarıyla gönderildi —{" "}
                      {submittedOffer?.price.toLocaleString(
                        "tr-TR",
                      )}{" "}
                      TL
                    </div>
                  ) : submittedJobIds.includes(job.id) ? (
                    <div
                      className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                        submittedOffer?.status === "accepted"
                          ? "bg-green-50 text-green-700"
                          : submittedOffer?.status === "rejected"
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      {submittedOffer?.status === "accepted"
                        ? "✓ Teklifin kabul edildi"
                        : submittedOffer?.status === "rejected"
                          ? "✕ Teklifin reddedildi"
                          : "✓ Teklif verdin"}{" "}
                      —{" "}
                      {submittedOffer?.price.toLocaleString(
                        "tr-TR",
                      )}{" "}
                      TL
                    </div>
                  ) : job.status !== "open" ? (
                    <div className="rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-600">
                      Bu ilan kapandı.
                    </div>
                  ) : selectedJobId === job.id ? (
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                      <div className="mb-5">
                        <h3 className="font-semibold">
                          Bu işe teklif ver
                        </h3>

                        <p className="mt-1 text-sm text-zinc-500">
                          Fiyatını ve müşteriye iletmek istediğin mesajı yaz.
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Teklif fiyatı
                          </label>

                          <div className="flex items-center rounded-lg border border-zinc-300 bg-white">
                            <input
                              type="number"
                              min="0"
                              value={price}
                              onChange={(e) =>
                                setPrice(e.target.value)
                              }
                              placeholder="8000"
                              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                            />

                            <span className="pr-3 text-sm text-zinc-500">
                              TL
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium">
                            Mesaj
                          </label>

                          <textarea
                            value={message}
                            onChange={(e) =>
                              setMessage(e.target.value)
                            }
                            placeholder="Müşteriye kendini ve teklifini kısaca anlat..."
                            rows={3}
                            className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                          />
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={closeOfferForm}
                          className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium"
                        >
                          Vazgeç
                        </button>

                        <button
                          type="button"
                          onClick={() => submitOffer(job.id)}
                          disabled={sending}
                          className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {sending
                            ? "Gönderiliyor..."
                            : "Teklifi Gönder"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openOfferForm(job.id)}
                      className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                    >
                      Teklif Ver
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}