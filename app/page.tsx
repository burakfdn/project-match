"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Role = "customer" | "provider" | null;

export default function HomePage() {
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

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

      setEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setRole(profile?.role ?? null);
      setLoading(false);
    }

    loadUser();
  }, []);

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">Yükleniyor...</p>
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
              Doğru iş,
              <br />
              doğru profesyonelle.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
              İşini yapabilecek profesyonellerden teklif al.
              Yeteneklerine uygun işleri keşfet ve gereksiz teklif
              kalabalığından kurtul.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="rounded-lg bg-black px-6 py-3 text-center text-sm font-medium text-white hover:bg-zinc-800"
              >
                Ücretsiz Başla
              </Link>

              <Link
                href="/login"
                className="rounded-lg border border-zinc-300 px-6 py-3 text-center text-sm font-medium hover:bg-zinc-50"
              >
                Giriş Yap
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-zinc-50">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-3">
            <div>
              <h2 className="font-semibold">Doğru eşleşme</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                İşler, hizmet kategorilerine göre uygun profesyonellerle
                eşleşir.
              </p>
            </div>

            <div>
              <h2 className="font-semibold">Daha az gürültü</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Herkes her işe teklif veremez. Sadece uygun kişiler
                öne çıkar.
              </p>
            </div>

            <div>
              <h2 className="font-semibold">Basit süreç</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                İşi oluştur, uygun teklifleri değerlendir ve
                profesyonelini seç.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <nav className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight"
          >
            Project Match
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-500 sm:block">
              {email}
            </span>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-zinc-500">
            {role === "provider"
              ? "Provider Paneli"
              : "Müşteri Paneli"}
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Hoş geldin.
          </h1>

          <p className="mt-3 text-zinc-600">
            {role === "provider"
              ? "Sana uygun işleri keşfet ve tekliflerini yönet."
              : "İhtiyacını yayınla ve uygun profesyonellerden teklif al."}
          </p>
        </div>

        {role === "customer" && (
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <Link
              href="/jobs/new"
              className="group rounded-2xl border border-zinc-200 bg-white p-7 transition hover:border-zinc-400"
            >
              <div className="text-2xl">＋</div>

              <h2 className="mt-5 text-xl font-semibold">
                Yeni İş Oluştur
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                İhtiyacını anlat, uygun profesyonellerden teklif
                almaya başla.
              </p>

              <span className="mt-6 inline-block text-sm font-medium">
                İş Oluştur →
              </span>
            </Link>

            <Link
              href="/my-jobs"
              className="group rounded-2xl border border-zinc-200 bg-white p-7 transition hover:border-zinc-400"
            >
              <div className="text-2xl">☰</div>

              <h2 className="mt-5 text-xl font-semibold">
                İşlerim
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Yayındaki işlerini ve gelen profesyonel tekliflerini
                görüntüle.
              </p>

              <span className="mt-6 inline-block text-sm font-medium">
                İşlerime Git →
              </span>
            </Link>
          </div>
        )}

        {role === "provider" && (
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <Link
              href="/jobs"
              className="group rounded-2xl border border-zinc-200 bg-white p-7 transition hover:border-zinc-400"
            >
              <div className="text-2xl">⌕</div>

              <h2 className="mt-5 text-xl font-semibold">
                Uygun İşler
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Hizmet kategorilerine uygun açık işleri keşfet ve
                teklif ver.
              </p>

              <span className="mt-6 inline-block text-sm font-medium">
                İşleri Gör →
              </span>
            </Link>

            <Link
              href="/profile"
              className="group rounded-2xl border border-zinc-200 bg-white p-7 transition hover:border-zinc-400"
            >
              <div className="text-2xl">◎</div>

              <h2 className="mt-5 text-xl font-semibold">
                Profilim
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Uzmanlıklarını, deneyimini ve hizmet kategorilerini
                güncel tut.
              </p>

              <span className="mt-6 inline-block text-sm font-medium">
                Profilime Git →
              </span>
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}