"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

type PopularService = {
  id: number;
  name: string;
  categoryName: string | null;
  openJobCount: number;
};

export function PopularServices() {
  const [services, setServices] = useState<PopularService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadPopularServices();
  }, []);

  async function loadPopularServices() {
    const supabase = createClient();

    setLoading(true);

    const { data, error } = await supabase
      .from("jobs")
      .select(
        `
          service_id,
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
      .eq("status", "open");

    if (error) {
      console.error("popular services error:", error);
      setServices([]);
      setLoading(false);
      return;
    }

    const counts = new Map<number, PopularService>();

    for (const row of (data ?? []) as Array<{
      service_id?: number | null;
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
    }>) {
      const nested = Array.isArray(row.service) ? row.service[0] : row.service;
      const id = Number(nested?.id ?? row.service_id);

      if (!Number.isFinite(id) || id <= 0) {
        continue;
      }

      const current = counts.get(id);

      if (current) {
        current.openJobCount += 1;
        continue;
      }

      counts.set(id, {
        id,
        name: nested?.name?.trim() || "Hizmet",
        categoryName: nested?.category?.name?.trim() || null,
        openJobCount: 1,
      });
    }

    const ranked = [...counts.values()].sort((a, b) => {
      if (b.openJobCount !== a.openJobCount) {
        return b.openJobCount - a.openJobCount;
      }

      return a.name.localeCompare(b.name, "tr");
    });

    setServices(ranked.slice(0, 8));
    setLoading(false);
  }

  if (loading) {
    return (
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
          Popüler Hizmetler
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          İhtiyacın olan hizmeti seç, uygun uzmanları keşfet.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`popular-service-skeleton-${index}`}
              className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5"
            >
              <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100" />
              <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
              <div className="mt-auto pt-5">
                <div className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (services.length === 0) {
    return null;
  }

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
        Popüler Hizmetler
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        İhtiyacın olan hizmeti seç, uygun uzmanları keşfet.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => (
          <Link
            key={service.id}
            href={`/providers?service=${encodeURIComponent(String(service.id))}`}
            className="group flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 hover:bg-zinc-50"
          >
            <h3 className="text-base font-semibold text-zinc-950">
              {service.name}
            </h3>
            {service.categoryName ? (
              <p className="mt-1.5 text-xs text-zinc-500">
                {service.categoryName}
              </p>
            ) : null}
            <p className="mt-3 text-sm text-zinc-600">
              {service.openJobCount} açık iş
            </p>
            <p className="mt-auto pt-5 text-sm font-medium text-violet-700 group-hover:text-violet-900">
              Keşfet →
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
