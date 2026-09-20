"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

type AnalyticsGroup = Record<string, unknown>;

type AnalyticsData = {
  users: AnalyticsGroup;
  jobs: AnalyticsGroup;
  offers: AnalyticsGroup;
  support: AnalyticsGroup;
};

type CategoryRow = {
  category_id: number;
  category_name: string;
  job_count: number;
  offer_count: number;
  accepted_count?: number;
  rejected_count?: number;
  pending_count?: number;
  acceptance_rate: number;
};

type ServiceRow = {
  service_id: number;
  service_name: string;
  category_id: number;
  category_name: string;
  job_count: number;
  offer_count: number;
  accepted_count?: number;
  rejected_count?: number;
  pending_count?: number;
  acceptance_rate: number;
};

type PerformanceData = {
  categories: CategoryRow[];
  services: ServiceRow[];
};

type ServiceSortKey =
  | "service_name"
  | "category_name"
  | "job_count"
  | "offer_count"
  | "acceptance_rate";

function toNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatCount(value: unknown) {
  return new Intl.NumberFormat("tr-TR").format(toNumber(value));
}

function formatRate(value: unknown) {
  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toNumber(value))}%`;
}

function parseRpcJson<T>(data: unknown) {
  if (typeof data === "string") {
    return JSON.parse(data) as T;
  }

  return data as T;
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
        {formatCount(value)}
      </p>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const supabase = createClient();

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [performanceError, setPerformanceError] = useState("");
  const [serviceSortKey, setServiceSortKey] =
    useState<ServiceSortKey>("job_count");
  const [serviceSortDir, setServiceSortDir] = useState<"asc" | "desc">("desc");
  const [showAllServices, setShowAllServices] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    setPerformanceError("");

    const [overviewResult, performanceResult] = await Promise.all([
      supabase.rpc("admin_get_analytics"),
      supabase.rpc("admin_get_analytics_performance"),
    ]);

    if (overviewResult.error) {
      setError(
        overviewResult.error.message ||
          "Analiz verileri yüklenirken bir hata oluştu.",
      );
      setAnalytics(null);
      setPerformance(null);
      setLoading(false);
      return;
    }

    setAnalytics(parseRpcJson<AnalyticsData>(overviewResult.data));

    if (performanceResult.error) {
      setPerformanceError(
        performanceResult.error.message ||
          "Kategori ve hizmet verileri yüklenirken bir hata oluştu.",
      );
      setPerformance(null);
    } else {
      const parsed = parseRpcJson<PerformanceData>(performanceResult.data);
      setPerformance({
        categories: Array.isArray(parsed?.categories) ? parsed.categories : [],
        services: Array.isArray(parsed?.services) ? parsed.services : [],
      });
    }

    setLoading(false);
  }

  const sortedCategories = useMemo(() => {
    const rows = [...(performance?.categories ?? [])];

    rows.sort((a, b) => {
      const jobDiff = toNumber(b.job_count) - toNumber(a.job_count);

      if (jobDiff !== 0) {
        return jobDiff;
      }

      return String(a.category_name ?? "").localeCompare(
        String(b.category_name ?? ""),
        "tr",
      );
    });

    return rows;
  }, [performance]);

  const maxCategoryJobs = useMemo(() => {
    return sortedCategories.reduce(
      (max, row) => Math.max(max, toNumber(row.job_count)),
      0,
    );
  }, [sortedCategories]);

  const sortedServices = useMemo(() => {
    const rows = [...(performance?.services ?? [])];
    const direction = serviceSortDir === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      if (
        serviceSortKey === "service_name" ||
        serviceSortKey === "category_name"
      ) {
        return (
          direction *
          String(a[serviceSortKey] ?? "").localeCompare(
            String(b[serviceSortKey] ?? ""),
            "tr",
          )
        );
      }

      const diff =
        toNumber(a[serviceSortKey]) - toNumber(b[serviceSortKey]);

      if (diff !== 0) {
        return direction * diff;
      }

      return String(a.service_name ?? "").localeCompare(
        String(b.service_name ?? ""),
        "tr",
      );
    });

    return rows;
  }, [performance, serviceSortKey, serviceSortDir]);

  const visibleServices = showAllServices
    ? sortedServices
    : sortedServices.slice(0, 10);

  function toggleServiceSort(key: ServiceSortKey) {
    if (serviceSortKey === key) {
      setServiceSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setServiceSortKey(key);
    setServiceSortDir(
      key === "service_name" || key === "category_name" ? "asc" : "desc",
    );
  }

  function sortLabel(key: ServiceSortKey, label: string) {
    if (serviceSortKey !== key) {
      return label;
    }

    return `${label} ${serviceSortDir === "asc" ? "↑" : "↓"}`;
  }

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight"
          >
            Project Match
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              Admin Paneli
            </Link>
            <Link
              href="/admin/users"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              Kullanıcılar
            </Link>
            <Link
              href="/admin/support"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              Destek Talepleri
            </Link>
            <Link
              href="/admin/activity"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              Aktivite Arşivi
            </Link>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
              Admin Paneli
            </span>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <p className="text-sm font-medium text-zinc-500">Yönetim</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Analytics
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Platformdaki kullanıcı, proje, teklif ve destek özetini görün.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500">Analiz verileri yükleniyor...</p>
        ) : analytics ? (
          <div className="space-y-10">
            <section>
              <h2 className="text-lg font-semibold text-zinc-900">
                Kullanıcılar
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label="Toplam kullanıcı"
                  value={analytics.users?.total}
                />
                <MetricCard
                  label="Aktif customer"
                  value={analytics.users?.active_customer}
                />
                <MetricCard
                  label="Aktif provider"
                  value={analytics.users?.active_provider}
                />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-zinc-900">
                Projeler
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard
                  label="Toplam proje"
                  value={analytics.jobs?.total}
                />
                <MetricCard label="Açık" value={analytics.jobs?.open} />
                <MetricCard
                  label="Devam ediyor"
                  value={analytics.jobs?.in_progress}
                />
                <MetricCard
                  label="Tamamlandı"
                  value={analytics.jobs?.completed}
                />
                <MetricCard
                  label="İptal"
                  value={analytics.jobs?.cancelled}
                />
                <MetricCard
                  label="Son 7 gün"
                  value={analytics.jobs?.last_7_days}
                />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-zinc-900">
                Teklifler
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Toplam teklif"
                  value={analytics.offers?.total}
                />
                <MetricCard
                  label="Kabul edilen"
                  value={analytics.offers?.accepted}
                />
                <MetricCard
                  label="Bekleyen"
                  value={analytics.offers?.pending}
                />
                <MetricCard
                  label="Son 7 gün"
                  value={analytics.offers?.last_7_days}
                />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-zinc-900">Destek</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Toplam talep"
                  value={analytics.support?.total}
                />
                <MetricCard
                  label="Açık / inceleniyor"
                  value={analytics.support?.open}
                />
                <MetricCard
                  label="Çözülen / kapanan"
                  value={analytics.support?.resolved_or_closed}
                />
                <MetricCard
                  label="Son 7 gün"
                  value={analytics.support?.last_7_days}
                />
              </div>
            </section>

            {performanceError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {performanceError}
              </div>
            ) : null}

            {performance ? (
              <>
                <section>
                  <h2 className="text-lg font-semibold text-zinc-900">
                    Kategori Performansı
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Kategoriler iş sayısına göre sıralanır.
                  </p>

                  <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
                    <p className="text-xs font-medium text-zinc-500">
                      İş sayısı
                    </p>
                    <div className="mt-4 space-y-3">
                      {sortedCategories.length === 0 ? (
                        <p className="text-sm text-zinc-500">
                          Kategori verisi bulunamadı.
                        </p>
                      ) : (
                        sortedCategories.map((row) => {
                          const jobs = toNumber(row.job_count);
                          const width =
                            maxCategoryJobs > 0
                              ? Math.max((jobs / maxCategoryJobs) * 100, jobs > 0 ? 4 : 0)
                              : 0;

                          return (
                            <div key={row.category_id}>
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <p className="truncate text-sm font-medium text-zinc-800">
                                  {row.category_name || "—"}
                                </p>
                                <p className="shrink-0 text-xs text-zinc-500">
                                  {formatCount(jobs)} iş
                                </p>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                                <div
                                  className="h-full rounded-full bg-zinc-900"
                                  style={{ width: `${width}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-zinc-50 text-xs font-medium text-zinc-500">
                        <tr>
                          <th className="px-4 py-3">Kategori</th>
                          <th className="px-4 py-3">İş / ilan</th>
                          <th className="px-4 py-3">Teklif</th>
                          <th className="px-4 py-3">Kabul oranı</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCategories.map((row) => (
                          <tr
                            key={row.category_id}
                            className="border-t border-zinc-100"
                          >
                            <td className="px-4 py-3 font-medium text-zinc-900">
                              {row.category_name || "—"}
                            </td>
                            <td className="px-4 py-3 text-zinc-600">
                              {formatCount(row.job_count)}
                            </td>
                            <td className="px-4 py-3 text-zinc-600">
                              {formatCount(row.offer_count)}
                            </td>
                            <td className="px-4 py-3 text-zinc-600">
                              {formatRate(row.acceptance_rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-zinc-900">
                    Hizmet Performansı
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatCount(sortedServices.length)} hizmet
                  </p>

                  <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-zinc-50 text-xs font-medium text-zinc-500">
                        <tr>
                          <th className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleServiceSort("service_name")}
                              className="font-medium hover:text-zinc-900"
                            >
                              {sortLabel("service_name", "Hizmet")}
                            </button>
                          </th>
                          <th className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleServiceSort("category_name")}
                              className="font-medium hover:text-zinc-900"
                            >
                              {sortLabel("category_name", "Kategori")}
                            </button>
                          </th>
                          <th className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleServiceSort("job_count")}
                              className="font-medium hover:text-zinc-900"
                            >
                              {sortLabel("job_count", "İş sayısı")}
                            </button>
                          </th>
                          <th className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleServiceSort("offer_count")}
                              className="font-medium hover:text-zinc-900"
                            >
                              {sortLabel("offer_count", "Teklif")}
                            </button>
                          </th>
                          <th className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                toggleServiceSort("acceptance_rate")
                              }
                              className="font-medium hover:text-zinc-900"
                            >
                              {sortLabel("acceptance_rate", "Kabul oranı")}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleServices.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-6 text-sm text-zinc-500"
                            >
                              Hizmet verisi bulunamadı.
                            </td>
                          </tr>
                        ) : (
                          visibleServices.map((row) => (
                            <tr
                              key={row.service_id}
                              className="border-t border-zinc-100"
                            >
                              <td className="px-4 py-3 font-medium text-zinc-900">
                                {row.service_name || "—"}
                              </td>
                              <td className="px-4 py-3 text-zinc-600">
                                {row.category_name || "—"}
                              </td>
                              <td className="px-4 py-3 text-zinc-600">
                                {formatCount(row.job_count)}
                              </td>
                              <td className="px-4 py-3 text-zinc-600">
                                {formatCount(row.offer_count)}
                              </td>
                              <td className="px-4 py-3 text-zinc-600">
                                {formatRate(row.acceptance_rate)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {sortedServices.length > 10 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllServices((current) => !current)}
                      className="mt-3 text-sm font-medium text-zinc-600 hover:text-zinc-950"
                    >
                      {showAllServices
                        ? "Hizmetleri gizle"
                        : "Tüm hizmetleri göster"}
                    </button>
                  ) : null}
                </section>
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
