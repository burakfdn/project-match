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
  created_at: string;
  categories: {
    name: string;
  } | null;
};

export default function JobsPage() {
  const supabase = createClient();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadJobs() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
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
          created_at,
          categories (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        setError("İlanlar yüklenemedi.");
        setLoading(false);
        return;
      }

      setJobs((data as Job[]) ?? []);
      setLoading(false);
    }

    loadJobs();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">İlanlar yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          Uygun İşler
        </h1>

        <p className="mt-2 text-sm text-zinc-600">
          Profilindeki hizmetlerle eşleşen işler.
        </p>

        {error && (
          <p className="mt-6 text-sm text-red-600">
            {error}
          </p>
        )}

        {!error && jobs.length === 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-8 text-center">
            <p className="text-sm text-zinc-500">
              Şu anda sana uygun bir iş bulunmuyor.
            </p>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {jobs.map((job) => (
            <article
              key={job.id}
              className="rounded-xl border border-zinc-200 p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {job.categories?.name ?? "Kategori"}
                  </p>

                  <h2 className="mt-1 text-xl font-semibold">
                    {job.title}
                  </h2>
                </div>

                {job.budget !== null && (
                  <div className="text-sm font-medium">
                    {job.budget.toLocaleString("tr-TR")} TL
                  </div>
                )}
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-600">
                {job.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-3 text-xs text-zinc-500">
                {job.city && <span>{job.city}</span>}

                <span>
                  {job.location_type === "remote"
                    ? "Uzaktan"
                    : job.location_type === "on_site"
                      ? "Yerinde"
                      : "Hibrit"}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}