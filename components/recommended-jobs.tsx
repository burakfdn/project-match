"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { getPreviewUser } from "@/lib/preview";
import { getJobPublicIdMap, jobHref } from "@/lib/jobs/public-id";

type JobCard = {
  id: number;
  public_id?: string | null;
  title: string;
  description: string | null;
  budget: number | null;
  city: string | null;
  location_type: string;
  created_at: string;
  serviceId: number | null;
  serviceName: string | null;
  categoryName: string | null;
};

type ProviderOffer = {
  job_id: number;
};

function excerpt(value: string | null, maxLength = 110) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

function getLocationLabel(job: JobCard) {
  if (job.location_type === "remote") {
    return "Uzaktan";
  }

  const workLabel =
    job.location_type === "on_site"
      ? "Yerinde"
      : job.location_type === "hybrid"
        ? "Hibrit"
        : null;

  return [job.city?.trim() || null, workLabel].filter(Boolean).join(" · ");
}

function formatBudget(budget: number | null) {
  if (budget) {
    return `${budget.toLocaleString("tr-TR")} TL`;
  }

  return "Belirtilmedi";
}

function formatJobDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeService(job: {
  service?:
    | {
        id?: number;
        name?: string | null;
        category?: { id?: number; name?: string | null } | null;
      }
    | Array<{
        id?: number;
        name?: string | null;
        category?: { id?: number; name?: string | null } | null;
      }>
    | null;
}) {
  const nested = Array.isArray(job.service) ? job.service[0] : job.service;

  return {
    serviceId: typeof nested?.id === "number" ? nested.id : null,
    serviceName: nested?.name?.trim() || null,
    categoryName: nested?.category?.name?.trim() || null,
  };
}

export function RecommendedJobs() {
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadRecommended();
  }, []);

  async function loadRecommended() {
    const supabase = createClient();

    setLoading(true);

    const previewUser = getPreviewUser();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setJobs([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    const effectiveUserId = previewUser?.id ?? user.id;
    const previewMode = previewUser !== null;

    let providerOffers: ProviderOffer[] = [];

    if (previewMode) {
      const { data: previewOffers, error: offersError } = await supabase.rpc(
        "admin_preview_provider_offers",
        { p_user_id: effectiveUserId },
      );

      if (offersError) {
        console.error(offersError);
        setJobs([]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      providerOffers = (previewOffers ?? []) as ProviderOffer[];
    } else {
      const { data, error: offersError } = await supabase
        .from("offers")
        .select("job_id")
        .eq("provider_id", effectiveUserId);

      if (offersError) {
        console.error(offersError);
        setJobs([]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      providerOffers = (data ?? []) as ProviderOffer[];
    }

    const offeredJobIds = new Set(
      providerOffers.map((offer) => Number(offer.job_id)),
    );

    let jobList: JobCard[] = [];

    if (previewMode) {
      const { data, error } = await supabase.rpc(
        "admin_preview_provider_jobs",
        { p_user_id: effectiveUserId },
      );

      if (error) {
        console.error(error);
        setJobs([]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      jobList = (
        (data ?? []) as Array<{
          id: number;
          title: string;
          description: string | null;
          budget: number | null;
          city: string | null;
          location_type: string;
          created_at?: string;
          service_id: number;
          service_name: string;
          category_name: string | null;
        }>
      ).map((job) => ({
        id: job.id,
        title: job.title,
        description: job.description,
        budget: job.budget,
        city: job.city,
        location_type: job.location_type,
        created_at: job.created_at ?? "",
        serviceId: job.service_id,
        serviceName: job.service_name,
        categoryName: job.category_name,
      }));
    } else {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          `
            id,
            public_id,
            title,
            description,
            budget,
            city,
            location_type,
            created_at,
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
        console.error(error);
        setJobs([]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      jobList = ((data as unknown as Array<Record<string, unknown>>) ?? []).map(
        (job) => {
          const service = normalizeService(job);

          return {
            id: Number(job.id),
            public_id:
              typeof job.public_id === "string" ? job.public_id : null,
            title: String(job.title ?? ""),
            description:
              typeof job.description === "string" ? job.description : null,
            budget:
              typeof job.budget === "number" ? job.budget : null,
            city: typeof job.city === "string" ? job.city : null,
            location_type: String(job.location_type ?? ""),
            created_at: String(job.created_at ?? ""),
            serviceId: service.serviceId,
            serviceName: service.serviceName,
            categoryName: service.categoryName,
          };
        },
      );
    }

    const publicIds = await getJobPublicIdMap(
      supabase,
      jobList.map((job) => job.id),
    );

    jobList = jobList.map((job) => ({
      ...job,
      public_id: job.public_id ?? publicIds.get(job.id) ?? null,
    }));

    const { data: providerServices, error: servicesError } = await supabase
      .from("provider_services")
      .select("service_id")
      .eq("provider_id", effectiveUserId);

    const serviceIds = new Set(
      servicesError
        ? []
        : ((providerServices ?? []) as Array<{ service_id: number }>).map(
            (row) => Number(row.service_id),
          ),
    );

    const eligible = jobList.filter((job) => !offeredJobIds.has(job.id));

    eligible.sort((a, b) => {
      const aServiceMatch =
        a.serviceId !== null && serviceIds.has(a.serviceId) ? 1 : 0;
      const bServiceMatch =
        b.serviceId !== null && serviceIds.has(b.serviceId) ? 1 : 0;

      if (bServiceMatch !== aServiceMatch) {
        return bServiceMatch - aServiceMatch;
      }

      const aBudget = a.budget !== null ? 1 : 0;
      const bBudget = b.budget !== null ? 1 : 0;

      if (bBudget !== aBudget) {
        return bBudget - aBudget;
      }

      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    setHasMore(eligible.length > 4);
    setJobs(eligible.slice(0, 4));
    setLoading(false);
  }

  if (loading) {
    return (
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
          Sana Uygun İşler
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Deneyimlerine ve hizmetlerine uygun yeni işleri keşfet.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`recommended-job-skeleton-${index}`}
              className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5"
            >
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
              <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
              <div className="mt-4 h-3 w-full animate-pulse rounded bg-zinc-100" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
              <div className="mt-auto pt-5">
                <div className="h-9 w-full animate-pulse rounded-lg bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (jobs.length === 0) {
    return null;
  }

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
            Sana Uygun İşler
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Deneyimlerine ve hizmetlerine uygun yeni işleri keşfet.
          </p>
        </div>

        {hasMore ? (
          <Link
            href="/jobs"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
          >
            Tüm İşleri Gör →
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {jobs.map((job) => {
          const description = excerpt(job.description);
          const openedAt = formatJobDate(job.created_at);
          const categoryLine = [job.categoryName, job.serviceName]
            .filter(Boolean)
            .join(" · ");

          return (
            <article
              key={job.id}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5"
            >
              <h3 className="text-base font-semibold text-zinc-950">
                {job.title}
              </h3>

              {categoryLine ? (
                <p className="mt-1.5 text-xs text-zinc-500">{categoryLine}</p>
              ) : null}

              <p className="mt-3 text-sm font-medium text-zinc-800">
                {formatBudget(job.budget)}
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                {[getLocationLabel(job), openedAt].filter(Boolean).join(" · ")}
              </p>

              {description ? (
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {description}
                </p>
              ) : null}

              <div className="mt-auto pt-5">
                <Link
                  href={jobHref(job)}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                >
                  İşi Gör
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
