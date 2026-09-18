"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import {
  clearPreviewUser,
  getPreviewUser,
  type PreviewUser,
} from "@/lib/preview";

type Mode = "customer" | "provider" | null;

type Permissions = {
  customer_enabled: boolean;
  provider_enabled: boolean;
  is_admin: boolean;
};

export default function HomePage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [permissions, setPermissions] =
    useState<Permissions | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [loading, setLoading] = useState(true);
  const [previewUser, setPreviewUser] =
    useState<PreviewUser | null>(null);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const activePreviewUser = getPreviewUser();

      if (activePreviewUser) {
        setPreviewUser(activePreviewUser);
        setEmail(activePreviewUser.email);

        const previewPermissions: Permissions = {
          customer_enabled:
            activePreviewUser.customer_enabled,
          provider_enabled:
            activePreviewUser.provider_enabled,
          is_admin: activePreviewUser.is_admin,
        };

        setPermissions(previewPermissions);

        const savedMode = localStorage.getItem(
          "project-match-mode",
        );

        if (
          savedMode === "customer" &&
          previewPermissions.customer_enabled
        ) {
          setMode("customer");
        } else if (
          savedMode === "provider" &&
          previewPermissions.provider_enabled
        ) {
          setMode("provider");
        } else if (
          previewPermissions.provider_enabled &&
          !previewPermissions.customer_enabled
        ) {
          setMode("provider");
        } else if (
          previewPermissions.customer_enabled &&
          !previewPermissions.provider_enabled
        ) {
          setMode("customer");
        }

        setLoading(false);
        return;
      }

      setEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "customer_enabled, provider_enabled, is_admin",
        )
        .eq("id", user.id)
        .single();

      const userPermissions: Permissions = profile ?? {
        customer_enabled: false,
        provider_enabled: false,
        is_admin: false,
      };

      setPermissions(userPermissions);

      const savedMode = localStorage.getItem(
        "project-match-mode",
      );

      if (
        savedMode === "customer" &&
        userPermissions.customer_enabled
      ) {
        setMode("customer");
      } else if (
        savedMode === "provider" &&
        userPermissions.provider_enabled
      ) {
        setMode("provider");
      } else if (
        userPermissions.provider_enabled &&
        !userPermissions.customer_enabled
      ) {
        setMode("provider");
      } else if (
        userPermissions.customer_enabled &&
        !userPermissions.provider_enabled
      ) {
        setMode("customer");
      }

      setLoading(false);
    }

    loadUser();
  }, []);

  function switchMode(newMode: "customer" | "provider") {
    localStorage.setItem(
      "project-match-mode",
      newMode,
    );

    setMode(newMode);

    window.dispatchEvent(
      new Event("project-match-mode-change"),
    );
  }

  function closePreview() {
    clearPreviewUser();

    setPreviewUser(null);

    router.push("/admin/users");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">
          Yükleniyor...
        </p>
      </main>
    );
  }

  if (!email) {
    return (
      <main className="min-h-screen">
        <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-zinc-500">
              Project Match
            </p>

            <h1 className="mt-4 text-5xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
              Doğru uzmanı, doğru projeyle buluştur.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
              İhtiyacını yayınla. Hizmetlerinle eşleşen
              uzmanlardan teklif al.
            </p>

            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center rounded-lg bg-black px-6 py-3 text-center text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto"
              >
                Proje Sahibi Olarak Başla
              </Link>

              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-6 py-3 text-center text-sm font-medium hover:bg-zinc-50 sm:w-auto"
              >
                Uzman Olarak Başla
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-xl font-semibold tracking-tight">
              Nasıl çalışır?
            </h2>

            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-zinc-500">
                  1
                </p>

                <h3 className="mt-2 font-semibold">
                  Projeni yayınla
                </h3>

                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  İhtiyacını, bütçeni ve çalışma şeklini belirt.
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-zinc-500">
                  2
                </p>

                <h3 className="mt-2 font-semibold">
                  Uygun uzmanlar görsün
                </h3>

                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Projen, hizmetleriyle ve çalışma koşullarıyla
                  eşleşen uzmanların karşısına çıkar.
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-zinc-500">
                  3
                </p>

                <h3 className="mt-2 font-semibold">
                  Teklifleri değerlendir
                </h3>

                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Gelen teklifleri incele, uzmanla mesajlaş ve
                  işi tamamla.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight">
              100 teklif değil. Doğru teklifler.
            </h2>

            <p className="mt-4 text-sm leading-6 text-zinc-600 sm:text-base">
              Project Match, herkese aynı ilanları göstermek
              yerine uzmanlık ve çalışma koşullarına göre uygun
              projeleri öne çıkarır.
            </p>
          </div>

          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-7">
              <h3 className="font-semibold">
                Proje Sahipleri için
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-600">
                İhtiyacını anlat, uygun uzmanlardan teklif al.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-7">
              <h3 className="font-semibold">
                Uzmanlar için
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Hizmetlerinle eşleşen projeleri keşfet, gerçekten
                yapabileceğin işlere teklif ver.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const customerEnabled =
    permissions?.customer_enabled ?? false;

  const providerEnabled =
    permissions?.provider_enabled ?? false;

  const isAdmin =
    permissions?.is_admin ?? false;

  const bothModesAvailable =
    customerEnabled && providerEnabled;

  const isCustomerMode = mode === "customer";
  const isProviderMode = mode === "provider";

  return (
    <main className="min-h-screen">
      {previewUser && (
        <div className="sticky top-0 z-50 border-b border-amber-300 bg-amber-100 px-4 py-3">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg">⚠</span>

              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Kullanıcı Önizlemesi
                </p>

                <p className="text-xs text-amber-800">
                  {previewUser.full_name ||
                    "İsimsiz kullanıcı"}
                  {" — "}
                  {previewUser.email || "-"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closePreview}
              className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50"
            >
              Önizlemeyi Kapat
            </button>
          </div>
        </div>
        )}

      <section
        className={`mx-auto max-w-6xl px-6 py-16 transition-colors ${
          isCustomerMode
            ? "bg-violet-50/20"
            : isProviderMode
              ? "bg-emerald-50/20"
              : ""
        }`}
      >
        {!mode && bothModesAvailable && (
          <>
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-zinc-500">
                Project Match
              </p>

              <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                Nasıl devam etmek istiyorsun?
              </h1>

              <p className="mt-3 text-zinc-600">
                İhtiyacına göre bir mod seçebilirsin.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => switchMode("customer")}
                className="group rounded-2xl border border-violet-200 bg-violet-50/40 p-7 text-left transition hover:border-violet-400 hover:bg-violet-50"
              >
                <div className="text-2xl text-violet-600">
                  ＋
                </div>

                <h2 className="mt-5 text-xl font-semibold">
                  Proje Sahibi
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Proje oluştur, ihtiyacını yayınla ve uygun
                  uzmanlardan teklif al.
                </p>

                <span className="mt-6 inline-block text-sm font-medium text-violet-700">
                  Proje Sahibi olarak devam et →
                </span>
              </button>

              <button
                type="button"
                onClick={() => switchMode("provider")}
                className="group rounded-2xl border border-emerald-200 bg-emerald-50/40 p-7 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
              >
                <div className="text-2xl text-emerald-600">
                  ⌕
                </div>

                <h2 className="mt-5 text-xl font-semibold">
                  Uzman
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Uzmanlıklarına uygun işleri keşfet ve teklif ver.
                </p>

                <span className="mt-6 inline-block text-sm font-medium text-emerald-700">
                  Uzman olarak devam et →
                </span>
              </button>
            </div>
          </>
        )}

        {mode === "customer" &&
          customerEnabled && (
            <>
              <div className="flex items-start justify-between gap-6">
                <div className="max-w-3xl">
                  <p className="text-sm font-medium text-violet-600">
                    Proje Sahibi Paneli
                  </p>

                  <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                    Hoş geldin.
                  </h1>

                  <p className="mt-3 text-zinc-600">
                    İhtiyacını yayınla ve uygun uzmanlardan teklif al.
                  </p>
                </div>

                {bothModesAvailable && (
                  <button
                    type="button"
                    onClick={() => switchMode("provider")}
                    className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    Uzman Moduna Geç
                  </button>
                )}
              </div>

              <div className="mt-10 grid gap-5 sm:grid-cols-2">
                <Link
                  href="/jobs/new"
                  className="group rounded-2xl border border-violet-200 bg-white p-7 transition hover:border-violet-400 hover:bg-violet-50/30"
                >
                  <div className="text-2xl text-violet-600">
                    ＋
                  </div>

                  <h2 className="mt-5 text-xl font-semibold">
                    Yeni İş Oluştur
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    İhtiyacını anlat, uygun uzmanlardan teklif
                    almaya başla.
                  </p>

                  <span className="mt-6 inline-block text-sm font-medium text-violet-700">
                    İş Oluştur →
                  </span>
                </Link>

                <Link
                  href="/my-jobs"
                  className="group rounded-2xl border border-violet-200 bg-white p-7 transition hover:border-violet-400 hover:bg-violet-50/30"
                >
                  <div className="text-2xl text-violet-600">
                    ☰
                  </div>

                  <h2 className="mt-5 text-xl font-semibold">
                    İşlerim
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Yayındaki işlerini ve gelen uzman tekliflerini
                    görüntüle.
                  </p>

                  <span className="mt-6 inline-block text-sm font-medium text-violet-700">
                    İşlerime Git →
                  </span>
                </Link>
              </div>
            </>
          )}

        {mode === "provider" &&
          providerEnabled && (
            <>
              <div className="flex items-start justify-between gap-6">
                <div className="max-w-3xl">
                  <p className="text-sm font-medium text-emerald-600">
                    Uzman Paneli
                  </p>

                  <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                    Hoş geldin.
                  </h1>

                  <p className="mt-3 text-zinc-600">
                    Sana uygun işleri keşfet ve tekliflerini yönet.
                  </p>
                </div>

                {bothModesAvailable && (
                  <button
                    type="button"
                    onClick={() => switchMode("customer")}
                    className="shrink-0 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
                  >
                    Proje Sahibi Moduna Geç
                  </button>
                )}
              </div>

              <div className="mt-10 grid gap-5 sm:grid-cols-2">
                <Link
                  href="/jobs"
                  className="group rounded-2xl border border-emerald-200 bg-white p-7 transition hover:border-emerald-400 hover:bg-emerald-50/30"
                >
                  <div className="text-2xl text-emerald-600">
                    ⌕
                  </div>

                  <h2 className="mt-5 text-xl font-semibold">
                    Uygun İşler
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Hizmet kategorilerine uygun açık işleri keşfet
                    ve teklif ver.
                  </p>

                  <span className="mt-6 inline-block text-sm font-medium text-emerald-700">
                    İşleri Gör →
                  </span>
                </Link>

                <Link
                  href="/profile"
                  className="group rounded-2xl border border-emerald-200 bg-white p-7 transition hover:border-emerald-400 hover:bg-emerald-50/30"
                >
                  <div className="text-2xl text-emerald-600">
                    ◎
                  </div>

                  <h2 className="mt-5 text-xl font-semibold">
                    Profilim
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Uzmanlıklarını, deneyimini ve hizmet kategorilerini
                    güncel tut.
                  </p>

                  <span className="mt-6 inline-block text-sm font-medium text-emerald-700">
                    Profilime Git →
                  </span>
                </Link>
              </div>
            </>
          )}

        {!customerEnabled &&
          !providerEnabled && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-7">
              <h2 className="text-xl font-semibold">
                Hesabında aktif yetki bulunmuyor.
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Hesabının kullanıma açılması için yöneticinle iletişime
                geçebilirsin.
              </p>
            </div>
          )}

        {isAdmin && !previewUser && (
          <div className="mt-10 border-t border-zinc-200 pt-6">
            <Link
              href="/admin/users"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              Admin Paneli →
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}