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

type Offer = {
  id: number;
  price: number;
  message: string | null;
  status: string;
  created_at: string;
  provider: {
    user_id: string;
    bio: string | null;
    experience_years: number;
    city: string | null;
  } | null;
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [offers, setOffers] = useState<Record<number, Offer[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setError("İlanlar yüklenirken bir hata oluştu.");
      setLoading(false);
      return;
    }

    setJobs((data as unknown as Job[]) ?? []);

    const jobIds = ((data as unknown as Job[]) ?? []).map((job) => job.id);

    if (jobIds.length > 0) {
      const { data: offerData, error: offerError } = await supabase
        .from("offers")
        .select(`
          id,
          job_id,
          price,
          message,
          status,
          created_at,
          provider:provider_profiles(
            user_id,
            bio,
            experience_years,
            city
          )
        `)
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });

      if (!offerError && offerData) {
        const grouped: Record<number, Offer[]> = {};

        for (const offer of offerData as any[]) {
          if (!grouped[offer.job_id]) {
            grouped[offer.job_id] = [];
          }

          grouped[offer.job_id].push(offer);
        }

        setOffers(grouped);
      }
    }

    setLoading(false);
  }

  async function updateOfferStatus(
    offerId: number,
    status: "accepted" | "rejected",
  ) {
    const supabase = createClient();

    const { error } = await supabase
      .from("offers")
      .update({ status })
      .eq("id", offerId);

    if (error) {
      setError("Teklif güncellenirken bir hata oluştu.");
      return;
    }

    await loadJobs();
  }

  useEffect(() => {
    loadJobs();
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <p>Yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          İlanlarım
        </h1>
        <p className="mt-2 text-zinc-600">
          Yayınladığın işler ve gelen teklifler.
        </p>
      </div>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600">
          {error}
        </p>
      )}

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 p-8 text-center">
          <p className="text-zinc-600">
            Henüz yayınladığın bir ilan yok.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {jobs.map((job) => {
            const jobOffers = offers[job.id] ?? [];

            return (
              <section
                key={job.id}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {job.title}
                    </h2>

                    <p className="mt-2 text-sm text-zinc-600">
                      {job.description}
                    </p>
                  </div>

                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs">
                    {job.status}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <span className="text-zinc-500">Kategori</span>
                    <p className="font-medium">
                      {job.category?.name ?? "-"}
                    </p>
                  </div>

                  <div>
                    <span className="text-zinc-500">Bütçe</span>
                    <p className="font-medium">
                      {job.budget
                        ? `${job.budget.toLocaleString("tr-TR")} TL`
                        : "Belirtilmedi"}
                    </p>
                  </div>

                  <div>
                    <span className="text-zinc-500">Konum</span>
                    <p className="font-medium">
                      {job.city ?? "Belirtilmedi"} · {job.location_type}
                    </p>
                  </div>
                </div>

                <div className="mt-8 border-t border-zinc-200 pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      Gelen Teklifler
                    </h3>

                    <span className="text-sm text-zinc-500">
                      {jobOffers.length} teklif
                    </span>
                  </div>

                  {jobOffers.length === 0 ? (
                    <p className="mt-4 text-sm text-zinc-500">
                      Henüz bu ilana teklif gelmedi.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {jobOffers.map((offer) => (
                        <div
                          key={offer.id}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 p-5"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-lg font-semibold">
                                {offer.price.toLocaleString("tr-TR")} TL
                              </p>

                              <p className="mt-1 text-sm text-zinc-600">
                                {offer.provider?.experience_years ?? 0} yıl
                                deneyim
                                {offer.provider?.city
                                  ? ` · ${offer.provider.city}`
                                  : ""}
                              </p>
                            </div>

                            <span className="rounded-full bg-white px-3 py-1 text-xs">
                              {offer.status}
                            </span>
                          </div>

                          {offer.provider?.bio && (
                            <p className="mt-4 text-sm text-zinc-700">
                              {offer.provider.bio}
                            </p>
                          )}

                          {offer.message && (
                            <div className="mt-4 rounded-lg bg-white p-4 text-sm text-zinc-700">
                              {offer.message}
                            </div>
                          )}

                          {offer.status === "pending" && (
                            <div className="mt-5 flex gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  updateOfferStatus(
                                    offer.id,
                                    "accepted",
                                  )
                                }
                                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white"
                              >
                                Teklifi Kabul Et
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateOfferStatus(
                                    offer.id,
                                    "rejected",
                                  )
                                }
                                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium"
                              >
                                Reddet
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}