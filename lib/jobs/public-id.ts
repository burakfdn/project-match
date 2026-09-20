import type { createClient } from "@/lib/supabase/client";

type JobRouteClient = ReturnType<typeof createClient>;

export type ResolvedJobRoute = {
  id: number;
  publicId: string;
};

export type CanonicalJobRouteResult =
  | { status: "missing" }
  | { status: "redirect" }
  | { status: "ok"; id: number; publicId: string };

type RouterReplace = {
  replace: (href: string) => void;
};

export function jobPath(publicId: string, suffix = "") {
  return `/jobs/${publicId}${suffix}`;
}

export function jobHref(
  job: { public_id?: string | null; id: number },
  suffix = "",
) {
  return `/jobs/${job.public_id || job.id}${suffix}`;
}

export function isCanonicalJobPublicPath(
  routeId: string,
  publicId: string,
) {
  return routeId.trim().toLowerCase() === publicId.trim().toLowerCase();
}

export async function resolveJobRoute(
  supabase: JobRouteClient,
  routeId: string,
): Promise<ResolvedJobRoute | null> {
  const ref = routeId.trim();

  if (!ref) {
    return null;
  }

  const { data, error } = await supabase.rpc("resolve_job_route", {
    p_ref: ref,
  });

  if (error) {
    console.error("resolve_job_route", error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    return null;
  }

  const record = row as { id?: unknown; public_id?: unknown };
  const id = Number(record.id);
  const publicId =
    record.public_id == null ? "" : String(record.public_id);

  if (!Number.isFinite(id) || id <= 0 || !publicId) {
    return null;
  }

  return { id, publicId };
}

export async function ensureCanonicalJobRoute(
  supabase: JobRouteClient,
  routeId: string,
  router: RouterReplace,
  suffix = "",
): Promise<CanonicalJobRouteResult> {
  const resolved = await resolveJobRoute(supabase, routeId);

  if (!resolved) {
    return { status: "missing" };
  }

  if (!isCanonicalJobPublicPath(routeId, resolved.publicId)) {
    router.replace(jobPath(resolved.publicId, suffix));
    return { status: "redirect" };
  }

  return {
    status: "ok",
    id: resolved.id,
    publicId: resolved.publicId,
  };
}

export async function getJobPublicIdMap(
  supabase: JobRouteClient,
  jobIds: number[],
): Promise<Map<number, string>> {
  const unique = [
    ...new Set(
      jobIds.filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  const map = new Map<number, string>();

  if (unique.length === 0) {
    return map;
  }

  const { data, error } = await supabase.rpc("get_job_public_ids", {
    p_job_ids: unique,
  });

  if (error) {
    console.error("get_job_public_ids", error);
    return map;
  }

  for (const row of (data ?? []) as Array<{
    id?: unknown;
    public_id?: unknown;
  }>) {
    const id = Number(row.id);
    const publicId = row.public_id == null ? "" : String(row.public_id);

    if (Number.isFinite(id) && id > 0 && publicId) {
      map.set(id, publicId);
    }
  }

  return map;
}
