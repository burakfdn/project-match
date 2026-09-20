"use client";

import type { ReactNode } from "react";

export type PublicProviderProfile = {
  full_name: string | null;
  bio: string | null;
  experience_years: number;
  city: string | null;
  can_work_remote: boolean;
  can_work_on_site: boolean;
};

export type PublicProviderService = {
  id: number;
  name: string;
  category: {
    id: number;
    name: string;
  } | null;
};

export type PublicWorkSample = {
  id: number;
  title: string;
  description: string | null;
  projectUrl: string | null;
  categories: {
    id: number;
    name: string;
  }[];
  services: {
    id: number;
    name: string;
  }[];
};

export type ReviewSummary = {
  average: string;
  count: number;
} | null;

export type PublicReview = {
  rating: number;
  comment: string | null;
  created_at: string;
};

function getInitials(name: string | null) {
  if (!name?.trim()) {
    return "U";
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function normalizeUrl(url: string) {
  const trimmed = url.trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function formatReviewDate(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getGroupedServices(services: PublicProviderService[]) {
  const groups = new Map<
    string,
    {
      categoryId: number | null;
      categoryName: string;
      services: PublicProviderService[];
    }
  >();

  for (const service of services) {
    const categoryName = service.category?.name?.trim() || "Diğer";
    const categoryId = service.category?.id ?? null;
    const key =
      categoryId !== null
        ? `category-${categoryId}`
        : `category-${categoryName}`;

    if (!groups.has(key)) {
      groups.set(key, {
        categoryId,
        categoryName,
        services: [],
      });
    }

    groups.get(key)!.services.push(service);
  }

  return Array.from(groups.values())
    .filter((group) => group.services.length > 0)
    .sort((a, b) => {
      if (a.categoryId === null && b.categoryId !== null) {
        return 1;
      }

      if (a.categoryId !== null && b.categoryId === null) {
        return -1;
      }

      return a.categoryName.localeCompare(b.categoryName, "tr-TR");
    });
}

export function ProviderPublicProfileView({
  profile,
  services,
  workSamples,
  workSamplesError,
  reviewSummary,
  reviews,
  showReviews,
  onToggleReviews,
  completedProjectCount,
  backLink,
  headerActions,
  workSamplesHeaderActions,
  workSamplesExtra,
  renderWorkSampleActions,
  footer,
}: {
  profile: PublicProviderProfile;
  services: PublicProviderService[];
  workSamples: PublicWorkSample[];
  workSamplesError?: string;
  reviewSummary: ReviewSummary;
  reviews: PublicReview[];
  showReviews: boolean;
  onToggleReviews: () => void;
  completedProjectCount: number;
  backLink?: ReactNode;
  headerActions?: ReactNode;
  workSamplesHeaderActions?: ReactNode;
  workSamplesExtra?: ReactNode;
  renderWorkSampleActions?: (work: PublicWorkSample) => ReactNode;
  footer?: ReactNode;
}) {
  const aboutText = profile.bio?.trim() ?? "";
  const visibleServiceGroups = getGroupedServices(services);

  return (
    <>
      {backLink}

      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-2xl font-semibold text-white">
          {getInitials(profile.full_name)}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            {profile.full_name?.trim() || "İsimsiz Uzman"}
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            {profile.experience_years > 0
              ? `${profile.experience_years} yıl deneyim`
              : "Deneyim belirtilmedi"}
            {profile.city?.trim() ? ` · ${profile.city.trim()}` : ""}
          </p>

          {services.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {services.slice(0, 4).map((service) => (
                <span
                  key={service.id}
                  className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
                >
                  {service.name}
                </span>
              ))}
            </div>
          ) : null}

          {reviewSummary ? (
            <button
              type="button"
              onClick={onToggleReviews}
              className="mt-2 text-left text-sm font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 hover:decoration-zinc-500"
              aria-expanded={showReviews}
            >
              {`⭐ ${reviewSummary.average} · ${reviewSummary.count} değerlendirme`}
            </button>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              Henüz değerlendirme yok
            </p>
          )}

          <p className="mt-1 text-sm text-zinc-500">
            {completedProjectCount > 0
              ? `💼 ${completedProjectCount} proje tamamladı`
              : "💼 Henüz proje tamamlamadı"}
          </p>

          {(profile.can_work_remote || profile.can_work_on_site) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.can_work_remote && profile.can_work_on_site ? (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                  Hibrit
                </span>
              ) : profile.can_work_remote ? (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                  Uzaktan
                </span>
              ) : (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                  Yerinde
                </span>
              )}
            </div>
          )}

          {headerActions ? <div className="mt-4">{headerActions}</div> : null}
        </div>
      </header>

      {showReviews && reviewSummary ? (
        <section className="mt-6 rounded-xl border border-zinc-200 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-zinc-900">
            Değerlendirmeler
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            {`⭐ ${reviewSummary.average} · ${reviewSummary.count} değerlendirme`}
          </p>

          <div className="mt-4 space-y-4">
            {reviews.map((review, index) => {
              const rating = Math.min(
                5,
                Math.max(0, Math.round(review.rating)),
              );
              const reviewDate = formatReviewDate(review.created_at);

              return (
                <article
                  key={`${review.created_at}-${index}`}
                  className="border-t border-zinc-100 pt-4 first:border-t-0 first:pt-0"
                >
                  <p
                    className="text-sm tracking-wide text-zinc-800"
                    aria-label={`${rating} yıldız`}
                  >
                    {"★★★★★".slice(0, rating)}
                    <span className="text-zinc-300">
                      {"★★★★★".slice(rating)}
                    </span>
                  </p>

                  {review.comment ? (
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      {review.comment}
                    </p>
                  ) : null}

                  {reviewDate ? (
                    <p className="mt-2 text-xs text-zinc-400">{reviewDate}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {aboutText ? (
        <section className="mt-10">
          <h2 className="text-base font-semibold text-zinc-900">Hakkımda</h2>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-600">
            {aboutText}
          </p>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-base font-semibold text-zinc-900">Hizmetler</h2>

        {visibleServiceGroups.length > 0 ? (
          <div className="mt-4 space-y-5">
            {visibleServiceGroups.map((group) => (
              <div
                key={
                  group.categoryId !== null
                    ? `category-${group.categoryId}`
                    : group.categoryName
                }
              >
                <h3 className="text-sm font-medium text-zinc-800">
                  {group.categoryName}
                </h3>

                <div className="mt-2 flex flex-wrap gap-2">
                  {group.services.map((service) => (
                    <span
                      key={service.id}
                      className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
                    >
                      {service.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">
            Hizmet bilgisi bulunmuyor.
          </p>
        )}
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900">
            Portfolyo
          </h2>
          {workSamplesHeaderActions}
        </div>

        {workSamplesExtra}

        {workSamplesError ? (
          <p className="mt-3 text-sm text-zinc-400">{workSamplesError}</p>
        ) : workSamples.length === 0 && !workSamplesExtra ? (
          <p className="mt-3 text-sm text-zinc-400">
            Henüz portfolyo çalışması eklenmemiş.
          </p>
        ) : workSamples.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">
            Henüz çalışma eklemedin.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {workSamples.map((work) => {
              const projectHref = work.projectUrl
                ? normalizeUrl(work.projectUrl)
                : "";

              return (
                <article
                  key={work.id}
                  className="flex flex-col rounded-xl border border-zinc-200 p-5"
                >
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {work.title}
                  </h3>

                  {work.description ? (
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      {work.description}
                    </p>
                  ) : null}

                  {work.categories.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {work.categories.map((category) => (
                        <span
                          key={`${work.id}-${category.id}`}
                          className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
                        >
                          {category.name}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {work.services.length > 0 ? (
                    <div
                      className={`flex flex-wrap gap-2 ${
                        work.categories.length > 0 ? "mt-2" : "mt-3"
                      }`}
                    >
                      {work.services.map((service) => (
                        <span
                          key={`${work.id}-service-${service.id}`}
                          className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
                        >
                          {service.name}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    {projectHref ? (
                      <a
                        href={projectHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-sm font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
                      >
                        Projeyi Gör ↗
                      </a>
                    ) : (
                      <span />
                    )}

                    {renderWorkSampleActions
                      ? renderWorkSampleActions(work)
                      : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {footer}
    </>
  );
}
