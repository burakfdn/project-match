"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { setPreviewUser, type PreviewUser } from "@/lib/preview";

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  customer_enabled: boolean;
  provider_enabled: boolean;
  is_admin: boolean;
  created_at: string;
};

type ViewedUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  customer_enabled: boolean;
  provider_enabled: boolean;
  is_admin: boolean;
};

export default function AdminUsersPage() {
  const supabase = createClient();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [viewedUser, setViewedUser] =
    useState<ViewedUser | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase.rpc(
      "admin_list_users",
    );

    if (error) {
      console.error("Admin users error:", error);

      setError(
        "Kullanıcılar yüklenirken bir hata oluştu.",
      );

      setLoading(false);
      return;
    }

    setUsers((data ?? []) as AdminUser[]);
    setLoading(false);
  }

  async function updatePermissions(
    userId: string,
    customerEnabled: boolean,
    providerEnabled: boolean,
    isAdmin: boolean,
  ) {
    setSavingId(userId);
    setError("");

    const { error } = await supabase.rpc(
      "admin_update_user_permissions",
      {
        p_user_id: userId,
        p_customer_enabled: customerEnabled,
        p_provider_enabled: providerEnabled,
        p_is_admin: isAdmin,
      },
    );

    if (error) {
      console.error(
        "Permission update error:",
        error,
      );

      setError(
        error.message ||
          "Yetkiler güncellenirken bir hata oluştu.",
      );

      setSavingId(null);
      return;
    }

    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId
          ? {
              ...user,
              customer_enabled: customerEnabled,
              provider_enabled: providerEnabled,
              is_admin: isAdmin,
            }
          : user,
      ),
    );

    if (viewedUser?.id === userId) {
      setViewedUser((currentUser) =>
        currentUser
          ? {
              ...currentUser,
              customer_enabled: customerEnabled,
              provider_enabled: providerEnabled,
              is_admin: isAdmin,
            }
          : null,
      );
    }

    setSavingId(null);
  }

  async function viewUser(userId: string) {
    setViewLoading(true);
    setError("");

    const { data, error } = await supabase.rpc(
      "admin_get_user_view",
      {
        p_user_id: userId,
      },
    );

    if (error) {
      console.error(
        "Admin view user error:",
        error,
      );

      setError(
        error.message ||
          "Kullanıcı görüntülenirken bir hata oluştu.",
      );

      setViewLoading(false);
      return;
    }

    const user = Array.isArray(data)
      ? data[0]
      : data;

    if (!user) {
      setError("Kullanıcı bulunamadı.");
      setViewLoading(false);
      return;
    }

    setViewedUser(user as ViewedUser);
    setViewLoading(false);
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

    console.log(
      "Project Match preview başlatılıyor:",
      previewData,
    );

    setPreviewUser(previewData);

    localStorage.removeItem(
      "project-match-mode",
    );

    window.location.href = "/";
  }

  function closeUserView() {
    setViewedUser(null);
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-zinc-500">
            Kullanıcılar yükleniyor...
          </p>
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

          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
            Admin Paneli
          </span>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <p className="text-sm font-medium text-zinc-500">
            Yönetim
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Kullanıcılar
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Platformdaki kullanıcıları ve yetkilerini
            buradan yönetebilirsin.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {viewedUser && (
          <div className="mb-8 rounded-2xl border border-blue-200 bg-blue-50/50 p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Kullanıcı Görünümü
                </p>

                <h2 className="mt-2 text-xl font-semibold text-zinc-900">
                  {viewedUser.full_name ||
                    "İsimsiz kullanıcı"}
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  {viewedUser.email || "-"}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    startPreview(viewedUser)
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Kullanıcı Olarak Gör
                </button>

                <button
                  type="button"
                  onClick={closeUserView}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                >
                  Kapat
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div
                className={`rounded-xl border p-4 ${
                  viewedUser.customer_enabled
                    ? "border-violet-200 bg-violet-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <p className="text-xs text-zinc-500">
                  Proje Sahibi
                </p>

                <p
                  className={`mt-1 text-sm font-semibold ${
                    viewedUser.customer_enabled
                      ? "text-violet-700"
                      : "text-zinc-400"
                  }`}
                >
                  {viewedUser.customer_enabled
                    ? "Aktif"
                    : "Pasif"}
                </p>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  viewedUser.provider_enabled
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <p className="text-xs text-zinc-500">
                  Uzman
                </p>

                <p
                  className={`mt-1 text-sm font-semibold ${
                    viewedUser.provider_enabled
                      ? "text-emerald-700"
                      : "text-zinc-400"
                  }`}
                >
                  {viewedUser.provider_enabled
                    ? "Aktif"
                    : "Pasif"}
                </p>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  viewedUser.is_admin
                    ? "border-violet-200 bg-violet-50"
                    : "border-zinc-200 bg-white"
                }`}
              >
                <p className="text-xs text-zinc-500">
                  Admin
                </p>

                <p
                  className={`mt-1 text-sm font-semibold ${
                    viewedUser.is_admin
                      ? "text-violet-700"
                      : "text-zinc-400"
                  }`}
                >
                  {viewedUser.is_admin
                    ? "Aktif"
                    : "Pasif"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-blue-100 bg-white px-4 py-3">
              <p className="text-sm leading-6 text-zinc-600">
                Kullanıcı olarak görüntüleme, admin hesabının
                oturumunu değiştirmez.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {users.map((user) => {
            const isSaving = savingId === user.id;

            return (
              <section
                key={user.id}
                className="rounded-2xl border border-zinc-200 bg-white p-6"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold text-zinc-900">
                        {user.full_name ||
                          "İsimsiz kullanıcı"}
                      </h2>

                      {user.is_admin && (
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                          Admin
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-zinc-500">
                      {user.email || "-"}
                    </p>

                    <p className="mt-2 text-xs text-zinc-400">
                      Kayıt:{" "}
                      {formatDate(user.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        viewUser(user.id)
                      }
                      disabled={viewLoading}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {viewLoading
                        ? "Yükleniyor..."
                        : "Kullanıcıyı Görüntüle"}
                    </button>

                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={user.customer_enabled}
                        disabled={isSaving}
                        onChange={(event) =>
                          updatePermissions(
                            user.id,
                            event.target.checked,
                            user.provider_enabled,
                            user.is_admin,
                          )
                        }
                        className="h-4 w-4"
                      />

                      <span className="text-sm font-medium text-zinc-700">
                        Proje Sahibi
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={user.provider_enabled}
                        disabled={isSaving}
                        onChange={(event) =>
                          updatePermissions(
                            user.id,
                            user.customer_enabled,
                            event.target.checked,
                            user.is_admin,
                          )
                        }
                        className="h-4 w-4"
                      />

                      <span className="text-sm font-medium text-zinc-700">
                        Uzman
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={user.is_admin}
                        disabled={isSaving}
                        onChange={(event) =>
                          updatePermissions(
                            user.id,
                            user.customer_enabled,
                            user.provider_enabled,
                            event.target.checked,
                          )
                        }
                        className="h-4 w-4"
                      />

                      <span className="text-sm font-medium text-zinc-700">
                        Admin
                      </span>
                    </label>
                  </div>
                </div>

                <div className="mt-5 border-t border-zinc-100 pt-4">
                  <p className="text-xs text-zinc-400">
                    {isSaving
                      ? "Kaydediliyor..."
                      : "Yetki değişiklikleri otomatik kaydedilir."}
                  </p>
                </div>
              </section>
            );
          })}
        </div>

        {users.length === 0 && (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-10 text-center text-sm text-zinc-500">
            Kullanıcı bulunamadı.
          </div>
        )}

        <p className="mt-4 text-xs text-zinc-400">
          Toplam {users.length} kullanıcı
        </p>
      </section>
    </main>
  );
}