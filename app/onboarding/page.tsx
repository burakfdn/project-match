"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountType = "customer" | "provider" | "both" | null;

export default function OnboardingPage() {
  const router = useRouter();

  const [accountType, setAccountType] = useState<AccountType>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!accountType) {
      setError("Lütfen bir seçenek seç.");
      return;
    }

    setPending(true);
    setError(null);

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const customerEnabled =
      accountType === "customer" || accountType === "both";

    const providerEnabled =
      accountType === "provider" || accountType === "both";

    const { error } = await supabase.rpc("set_my_account_type", {
      p_customer_enabled: customerEnabled,
      p_provider_enabled: providerEnabled,
    });

    if (error) {
      console.error(error);
      setError("Profil güncellenirken bir hata oluştu.");
      setPending(false);
      return;
    }

    localStorage.removeItem("project-match-mode");

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <p className="text-sm font-medium text-zinc-500">
          Project Match
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Project Match&apos;e hoş geldin
        </h1>

        <p className="mt-2 text-zinc-600">
          Platformu nasıl kullanmak istiyorsun?
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setAccountType("customer")}
            className={`rounded-xl border p-6 text-left transition ${
              accountType === "customer"
                ? "border-violet-400 bg-violet-50"
                : "border-zinc-200 hover:border-violet-300"
            }`}
          >
            <div className="text-lg font-medium">
              Proje Sahibi
            </div>

            <div className="mt-2 text-sm leading-6 text-zinc-600">
              İhtiyacımı yayınlamak ve uygun uzmanlardan
              teklif almak istiyorum.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setAccountType("provider")}
            className={`rounded-xl border p-6 text-left transition ${
              accountType === "provider"
                ? "border-emerald-400 bg-emerald-50"
                : "border-zinc-200 hover:border-emerald-300"
            }`}
          >
            <div className="text-lg font-medium">
              Uzman
            </div>

            <div className="mt-2 text-sm leading-6 text-zinc-600">
              Uzmanlıklarıma uygun işler bulmak ve teklif
              vermek istiyorum.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setAccountType("both")}
            className={`rounded-xl border p-6 text-left transition ${
              accountType === "both"
                ? "border-blue-400 bg-blue-50"
                : "border-zinc-200 hover:border-blue-300"
            }`}
          >
            <div className="text-lg font-medium">
              Her İkisi
            </div>

            <div className="mt-2 text-sm leading-6 text-zinc-600">
              Hem proje oluşturmak hem de uzman olarak
              iş almak istiyorum.
            </div>
          </button>
        </div>

        {error && (
          <p
            className="mt-4 text-sm text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!accountType || pending}
          className="mt-6 w-full rounded-md bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Kaydediliyor..." : "Devam et"}
        </button>
      </div>
    </main>
  );
}