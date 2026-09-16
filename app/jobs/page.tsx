"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getPreviewUser } from "@/lib/preview";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: number;
  customer_id: string;
  title: string;
  description: string;
  budget: number | null;
  city: string | null;
  location_type: string;
  deadline: string | null;
  status: string;
  service: {
    id: number;
    name: string;
    category: {
      id: number;
      name: string;
    } | null;
  } | null;
};

type ProviderOffer = {
  job_id: number;
  price: number;
  status: string;
};

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedJobIds, setSubmittedJobIds] = useState<number[]>([]);
  const [submittedOffers, setSubmittedOffers] = useState<
    Record<number, { price: number; status: string }>
  >({});
  const [isPreview, setIsPreview] = useState(false);

  async function loadJobs() {
    const supabase = createClient();

    setLoading(true);
    setError(null);

    const previewUser = getPreviewUser();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Giriş yapmalısın.");
      setLoading(false);
      return;
    }

    const effectiveUserId = previewUser?.id ?? user.id;
    const previewMode = previewUser !== null;

    setIsPreview(previewMode);

    let providerOffers: ProviderOffer[] = [];

    /*
     * Preview modunda seçilen uzman adına göre teklifleri
     * admin RPC üzerinden alıyoruz.
     *
     * Normal kullanımda mevcut RLS sistemi kullanılıyor.
     */
    if (previewMode) {
      const { data: previewOffers, error: offersError } =
        await supabase.rpc("admin_preview_provider_offers", {
          p_user_id: effectiveUserId,
        });

      if (offersError) {
        setError(
          `Teklifler yüklenirken bir hata oluştu: ${offersError.message}`,
        );
        setLoading(false);
        return;
      }

      providerOffers = (previewOffers ?? []) as ProviderOffer[];
    } else {
      const { data, error: offersError } = await supabase
        .from("offers")
        .select("job_id, price, status")
        .eq("provider_id", effectiveUserId);

      if (offersError) {
        setError(
          `Teklifler yüklenirken bir hata oluştu: ${offersError.message}`,
        );
        setLoading(false);
        return;
      }

      providerOffers = (data ?? []) as ProviderOffer[];
    }

    const submittedJobIdsFromDb = providerOffers.map(
      (offer) => offer.job_id,
    );

    let jobList: Job[] = [];

    if (previewMode) {
      /*
       * Preview modunda RLS'nin gerçek admin kullanıcısını değil,
       * seçilen uzmanı dikkate alması için admin RPC kullanıyoruz.
       */
      const { data, error } = await supabase.rpc(
        "admin_preview_provider_jobs",
        {
          p_user_id: effectiveUserId,
        },
      );

      if (error) {
        setError(
          `Uygun işler yüklenirken bir hata oluştu: ${error.message}`,
        );
        setLoading(false);
        return;
      }

      jobList = (
        (data ?? []) as Array<{
          id: number;
          customer_id: string;
          title: string;
          description: string;
          budget: number | null;
          city: string | null;
          location_type: string;
          deadline: string | null;
          status: string;
          service_id: number;
          service_name: string;
          category_id: number | null;
          category_name: string | null;
        }>
      ).map((job) => ({
        id: job.id,
        customer_id: job.customer_id,
        title: job.title,
        description: job.description,
        budget: job.budget,
        city: job.city,
        location_type: job.location_type,
        deadline: job.deadline,
        status: job.status,
        service: {
          id: job.service_id,
          name: job.service_name,
          category: job.category_id
            ? {
                id: job.category_id,
                name: job.category_name ?? "",
              }
            : null,
        },
      }));
    } else {
      /*
       * Normal kullanıcı:
       * Mevcut RLS + matching sistemi aynen çalışıyor.
       */
      const { data, error } = await supabase
        .from("jobs")
        .select(
          `
            id,
            customer_id,
            title,
            description,
            budget,
            city,
            location_type,
            deadline,
            status,
            service:services (
              id,
              name,
              category:categories (
                id,
                name
              )
            )
          `,
        )
        .eq("status", "open")
        .neq("customer_id", effectiveUserId)
        .order("created_at", { ascending: false });

      if (error) {
        setError(
          `Uygun işler yüklenirken bir hata oluştu: ${error.message}`,
        );
        setLoading(false);
        return;
      }

      jobList = (data as unknown as Job[]) ?? [];
    }

    setJobs(jobList);
    setSubmittedJobIds(submittedJobIdsFromDb);

    const offerMap: Record<
      number,
      { price: number; status: string }
    > = {};

    providerOffers.forEach((offer) => {
      offerMap[offer.job_id] = {
        price: offer.price,
        status: offer.status,
      };
    });

    setSubmittedOffers(offerMap);
    setLoading(false);
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
      {isPreview && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Kullanıcı önizlemesi aktif. Bu sayfadaki işler seçilen uzman
          hesabına göre gösteriliyor.
        </div>
      )}

      <div className="mb-10">
        <p className="text-sm font-medium text-zinc-500">
          Uzman Paneli
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Uygun İşler
        </h1>

        <p className="mt-2 text-zinc-500">
          Hizmetlerine ve çalışma bölgene uygun açık işleri burada
          görebilirsin.
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
            Profilindeki hizmetleri ve çalışma bölgelerini
            güncellediğinde daha fazla iş görebilirsin.
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          {jobs.map((job) => {
            const submittedOffer = submittedOffers[job.id];

            const categoryName =
              job.service?.category?.name?.trim() ?? "";

            const serviceName =
              job.service?.name?.trim() ?? "";

            const showCategory =
              categoryName !== "" &&
              categoryName.toLocaleLowerCase("tr-TR") !==
                serviceName.toLocaleLowerCase("tr-TR");

            return (
              <article
                key={job.id}
                onClick={(event) => {
                  const target =
                    event.target as HTMLElement;

                  if (
                    target.closest(
                      "a, button",
                    )
                  ) {
                    return;
                  }

                  router.push(
                    `/jobs/${job.id}`,
                  );
                }}
                className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-zinc-300"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {showCategory && (
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                          {categoryName}
                        </span>
                      )}

                      {serviceName && (
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                          {serviceName}
                        </span>
                      )}

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

                  <div className="shrink-0 rounded-xl bg-zinc-50 px-5 py-4 sm:min-w-32">
                    <p className="text-xs text-zinc-500">
                      Proje bütçesi
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
                  {submittedJobIds.includes(job.id) ? (
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
                      {submittedOffer?.price.toLocaleString("tr-TR")} TL
                    </div>
                  ) : isPreview ? (
                    <button
                      type="button"
                      disabled
                      className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Önizlemede Teklif Verilemez
                    </button>
                  ) : (
                    <Link
                      href={`/jobs/${job.id}/offer`}
                      className="inline-flex rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                    >
                      Teklif Ver
                    </Link>
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