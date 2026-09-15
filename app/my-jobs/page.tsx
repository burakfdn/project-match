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
  provider: {
    user_id: string;
    bio: string | null;
    experience_years: number;
    city: string | null;
  } | null;
};

export default function MyJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [offers, setOffers] = useState<Record<number, Offer[]>>({});
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: jobsData } = await supabase
      .from("jobs")
      .select(`
        id,
        title,
        description,
        budget,
        city,
        location_type,
        status,
        category:categories(name)
      `)
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });

    const loadedJobs = (jobsData as unknown as Job[]) ?? [];
    setJobs(loadedJobs);

    if (loadedJobs.length === 0) {
      setLoading(false);
      return;
    }

    const jobIds = loadedJobs.map((job) => job.id);

    const { data: offersData } = await supabase
      .from("offers")
      .select(`
        id,
        job_id,
        price,
        message,
        status,
        provider:provider_profiles(
          user_id,
          bio,
          experience_years,
          city
        )
      `)
      .in("job_id", jobIds)
      .order("created_at", { ascending: false });

    const grouped: Record<number, Offer[]> = {};

    for (const offer of (offersData as any[]) ?? []) {
      if (!grouped[offer.job_id]) {
        grouped[offer.job_id] = [];
      }

      grouped[offer.job_id].push(offer);
    }

    setOffers(grouped);
    setLoading(false);
  }

  async function updateOffer(
    offerId: number,
    status: "accepted" | "rejected",
  ) {
    const supabase = createClient();
  
    if (status === "accepted") {
      const { error } = await supabase.rpc("accept_offer", {
        p_offer_id: offerId,
      });
  
      if (error) {
        alert("Teklif kabul edilirken bir hata oluştu.");
        return;
      }
    } else {
      const { error } = await supabase
        .from("offers")
        .update({ status: "rejected" })
        .eq("id", offerId);
  
      if (error) {
        alert("Teklif reddedilirken bir hata oluştu.");
        return;
      }
    }
  
    await loadData();
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-zinc-500">Yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          İlanlarım
        </h1>
        <p className="mt-2 text-zinc-500">
          Yayınladığın işler ve aldığın teklifler.
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 p-10 text-center">
          <p className="text-zinc-500">
            Henüz bir ilan oluşturmadın.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {jobs.map((job) => {
            const jobOffers = offers[job.id] ?? [];

            return (
              <section key={job.id}>
                {/* JOB */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-7">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium">
                          {job.category?.name ?? "Kategori"}
                        </span>

                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs">
                          {job.status}
                        </span>
                      </div>

                      <h2 className="text-2xl font-semibold">
                        {job.title}
                      </h2>

                      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                        {job.description}
                      </p>
                    </div>

                    <div className="shrink-0 rounded-xl bg-zinc-50 px-5 py-4 text-center">
                      <div className="text-xs text-zinc-500">
                        Bütçe
                      </div>

                      <div className="mt-1 text-lg font-semibold">
                        {job.budget
                          ? `${job.budget.toLocaleString("tr-TR")} TL`
                          : "Belirtilmedi"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-6 border-t border-zinc-100 pt-5 text-sm">
                    <div>
                      <span className="text-zinc-400">Konum</span>
                      <div className="mt-1 font-medium">
                        {job.city ?? "Belirtilmedi"}
                      </div>
                    </div>

                    <div>
                      <span className="text-zinc-400">
                        Çalışma şekli
                      </span>
                      <div className="mt-1 font-medium">
                        {job.location_type}
                      </div>
                    </div>

                    <div>
                      <span className="text-zinc-400">
                        Teklif
                      </span>
                      <div className="mt-1 font-medium">
                        {jobOffers.length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* OFFERS */}
                <div className="mt-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      Gelen teklifler
                    </h3>

                    <span className="text-sm text-zinc-500">
                      {jobOffers.length} teklif
                    </span>
                  </div>

                  {jobOffers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
                      Bu ilana henüz teklif gelmedi.
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {jobOffers.map((offer) => (
                        <div
                          key={offer.id}
                          className="rounded-2xl border border-zinc-200 bg-white p-6"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-2xl font-semibold">
                                {offer.price.toLocaleString("tr-TR")} TL
                              </div>

                              <div className="mt-2 text-sm text-zinc-500">
                                {offer.provider?.experience_years ?? 0} yıl
                                deneyim
                                {offer.provider?.city
                                  ? ` · ${offer.provider.city}`
                                  : ""}
                              </div>
                            </div>

                            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs">
                              {offer.status}
                            </span>
                          </div>

                          {offer.provider?.bio && (
                            <div className="mt-5 border-t border-zinc-100 pt-5">
                              <p className="text-sm leading-6 text-zinc-600">
                                {offer.provider.bio}
                              </p>
                            </div>
                          )}

                          {offer.message && (
                            <div className="mt-4 rounded-xl bg-zinc-50 p-4">
                              <div className="mb-1 text-xs font-medium text-zinc-400">
                                Teklif mesajı
                              </div>

                              <p className="text-sm leading-6 text-zinc-700">
                                {offer.message}
                              </p>
                            </div>
                          )}

                          {offer.status === "pending" && (
                            <div className="mt-5 flex gap-3">
                              <button
                                onClick={() =>
                                  updateOffer(
                                    offer.id,
                                    "accepted",
                                  )
                                }
                                className="flex-1 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white"
                              >
                                Kabul Et
                              </button>

                              <button
                                onClick={() =>
                                  updateOffer(
                                    offer.id,
                                    "rejected",
                                  )
                                }
                                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium"
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