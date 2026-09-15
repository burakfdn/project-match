"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [role, setRole] = useState<"customer" | "provider" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!role) {
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

    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", user.id);

    if (error) {
      setError("Profil güncellenirken bir hata oluştu.");
      setPending(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-semibold tracking-tight">
          Project Match'e hoş geldin
        </h1>

        <p className="mt-2 text-zinc-600">
          Platformu nasıl kullanmak istiyorsun?
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setRole("customer")}
            className={`rounded-xl border p-6 text-left transition ${
              role === "customer"
                ? "border-black bg-zinc-100"
                : "border-zinc-200 hover:border-zinc-400"
            }`}
          >
            <div className="text-lg font-medium">Hizmet arıyorum</div>
            <div className="mt-2 text-sm text-zinc-600">
              İşimi yapacak uygun profesyoneller arıyorum.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setRole("provider")}
            className={`rounded-xl border p-6 text-left transition ${
              role === "provider"
                ? "border-black bg-zinc-100"
                : "border-zinc-200 hover:border-zinc-400"
            }`}
          >
            <div className="text-lg font-medium">Hizmet veriyorum</div>
            <div className="mt-2 text-sm text-zinc-600">
              Yeteneklerimle iş almak ve teklif vermek istiyorum.
            </div>
          </button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!role || pending}
          className="mt-6 w-full rounded-md bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Kaydediliyor..." : "Devam et"}
        </button>
      </div>
    </main>
  );
}