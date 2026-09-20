"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getPreviewUser, setPreviewUser, type PreviewUser } from "@/lib/preview";

type ViewedUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  customer_enabled: boolean;
  provider_enabled: boolean;
  is_admin: boolean;
};

export default function AdminUserDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();

  const userId =
    typeof params.id === "string" ? params.id : "";

  const [viewedUser, setViewedUser] = useState<ViewedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadUser();
  }, [userId]);

  async function loadUser() {
    setLoading(true);
    setError("");
    setNotFound(false);

    if (getPreviewUser()) {
      router.replace("/");
      return;
    }

    const { data: permissionData, error: permissionError } =
      await supabase.rpc("get_my_permissions");

    if (permissionError) {
      router.replace("/");
      return;
    }

    const permissionRow = Array.isArray(permissionData)
      ? permissionData[0]
      : permissionData;

    if (!permissionRow?.is_admin) {
      router.replace("/");
      return;
    }

    if (
      !userId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId,
      )
    ) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const { data, error: viewError } = await supabase.rpc(
      "admin_get_user_view",
      {
        p_user_id: userId,
      },
    );

    if (viewError) {
      console.error("Admin user detail error:", viewError);
      setError(
        viewError.message ||
          "Kullanıcı görüntülenirken bir hata oluştu.",
      );
      setViewedUser(null);
      setLoading(false);
      return;
    }

    const user = Array.isArray(data) ? data[0] : data;

    if (!user) {
      setNotFound(true);
      setViewedUser(null);
      setLoading(false);
      return;
    }

    setViewedUser(user as ViewedUser);
    setLoading(false);
  }

  function startPreview(user: ViewedUser) {
    const previewData: PreviewUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      customer_enabled: user.customer_enabled,
      provider_enabled: user.provider_enabled,
      is_admin: user.is_admin,
    };

    setPreviewUser(previewData);
    localStorage.removeItem("project-match-mode");
    window.location.href = "/";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-zinc-500">Kullanıcı yükleniyor...</p>
        </div>
      </main>
    );
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
              className="text-sm font-medium text-zinc-950"
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
        <Link
          href="/admin/users"
          className="mb-6 inline-block text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
        >
          ← Kullanıcılar
        </Link>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {notFound || !viewedUser ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
            <p className="text-sm text-zinc-700">Kullanıcı bulunamadı.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Kullanıcı Görünümü
                </p>

                <h1 className="mt-2 text-xl font-semibold text-zinc-900">
                  {viewedUser.full_name || "İsimsiz kullanıcı"}
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                  {viewedUser.email || "-"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => startPreview(viewedUser)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Kullanıcı Olarak Gör
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div
                className={`rounded-xl border p-4 ${
                  viewedUser.customer_enabled
                    ? "border-violet-200 bg-violet-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <p className="text-xs text-zinc-500">Proje Sahibi</p>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    viewedUser.customer_enabled
                      ? "text-violet-700"
                      : "text-zinc-400"
                  }`}
                >
                  {viewedUser.customer_enabled ? "Aktif" : "Pasif"}
                </p>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  viewedUser.provider_enabled
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <p className="text-xs text-zinc-500">Uzman</p>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    viewedUser.provider_enabled
                      ? "text-emerald-700"
                      : "text-zinc-400"
                  }`}
                >
                  {viewedUser.provider_enabled ? "Aktif" : "Pasif"}
                </p>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  viewedUser.is_admin
                    ? "border-violet-200 bg-violet-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <p className="text-xs text-zinc-500">Admin</p>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    viewedUser.is_admin
                      ? "text-violet-700"
                      : "text-zinc-400"
                  }`}
                >
                  {viewedUser.is_admin ? "Aktif" : "Pasif"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-blue-100 bg-white px-4 py-3">
              <p className="text-sm leading-6 text-zinc-600">
                Kullanıcı olarak görüntüleme, admin hesabının oturumunu
                değiştirmez.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
