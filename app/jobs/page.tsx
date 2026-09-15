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
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (error) {
      setError("Uygun işler yüklenirken bir hata oluştu.");
      setLoading(false);
      return;
    }

    setJobs((data as unknown as Job[]) ?? []);
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

    const { error } = await supabase.from("offers").insert({
      job_id: jobId,
      provider_id: user.id,
      price: Number(price),
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
        <p className="text-zinc-500">Uygun işler yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      {/* HEADER */}
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

      {/* ERROR */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* EMPTY */}
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
          {jobs.map((job) => (
            <article
              key={job.id}
              className="rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-zinc-300"
            >
              {/* JOB HEADER */}
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                      {job.category?.name ?? "Kategori"}
                    </span>

                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                      Açık
                    </span>
                  </div>

                  <h2 className="text-xl font-semibold text-zinc-950">
                    {job.title}
                  </h2>

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                    {job.description}
                  </p>
                </div>

                {/* BUDGET */}
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

              {/* JOB DETAILS */}
              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4 border-t border-zinc-100 pt-5">
                <div>
                  <p className="text-xs text-zinc-400">Konum</p>
                  <p className="mt-1 text-sm font-medium">
                    {job.city ?? "Belirtilmedi"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-zinc-400">
                    Çalışma şekli
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {job.location_type}
                  </p>
                </div>

                {job.deadline && (
                  <div>
                    <p className="text-xs text-zinc-400">
                      Son tarih
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {new Date(job.deadline).toLocaleDateString(
                        "tr-TR",
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* ACTION */}
              <div className="mt-6 border-t border-zinc-100 pt-5">
                {successJobId === job.id ? (
                  <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                    ✓ Teklifin başarıyla gönderildi.
                  </div>
                ) : selectedJobId === job.id ? (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                    <div className="mb-5">
                      <h3 className="font-semibold">
                        Bu işe teklif ver
                      </h3>

                      <p className="mt-1 text-sm text-zinc-500">
                        Fiyatını ve müşteriye iletmek istediğin mesajı
                        yaz.
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
                            onChange={(e) => setPrice(e.target.value)}
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
                          onChange={(e) => setMessage(e.target.value)}
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
                        {sending ? "Gönderiliyor..." : "Teklifi Gönder"}
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
          ))}
        </div>
      )}
    </main>
  );
}