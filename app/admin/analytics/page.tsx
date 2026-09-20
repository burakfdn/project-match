"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

type AnalyticsGroup = Record<string, unknown>;

type AnalyticsData = {
  users: AnalyticsGroup;
  jobs: AnalyticsGroup;
  offers: AnalyticsGroup;
  support: AnalyticsGroup;
};

function formatCount(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(n)) {
    return "0";
  }

  return new Intl.NumberFormat("tr-TR").format(n);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    setError("");

    const { data, error: analyticsError } = await supabase.rpc(
      "admin_get_analytics",
    );

    if (analyticsError) {
      setError(
        analyticsError.message ||
          "Analiz verileri yüklenirken bir hata oluştu.",
      );
      setAnalytics(null);
      setLoading(false);
      return;
    }

    const parsed =
      typeof data === "string" ? JSON.parse(data) : data;

    setAnalytics(parsed as AnalyticsData);
    setLoading(false);
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
          </div>
        ) : null}
      </section>
    </main>
  );
}
