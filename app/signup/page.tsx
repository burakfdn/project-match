"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setError("E-posta ve şifre gerekli.");
      return;
    }

    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    setPending(false);

    if (authError) {
      setError(getAuthErrorMessage(authError));
      return;
    }

    if (!data.session) {
      setInfo("Kayıt alındı. Giriş yapmadan önce e-posta kutunu kontrol et.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Kayıt ol</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Hesabın varsa{" "}
          <Link href="/login" className="font-medium text-zinc-950 underline">
            giriş yap
          </Link>
          .
        </p>

        <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm">
            E-posta
            <input
              className="rounded-md border border-zinc-300 px-3 py-2"
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Şifre
            <input
              className="rounded-md border border-zinc-300 px-3 py-2"
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {info ? (
            <p className="text-sm text-zinc-700" role="status">
              {info}
            </p>
          ) : null}

          <button
            className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            type="submit"
            disabled={pending}
          >
            {pending ? "Kayıt oluşturuluyor…" : "Kayıt ol"}
          </button>
        </form>
      </div>
    </main>
  );
}
