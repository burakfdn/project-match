"use client";

import { useEffect, useState } from "react";

import { ACTIVE_MODE_CHANGE_EVENT } from "@/lib/active-mode";
import { getPreviewUser } from "@/lib/preview";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerEnabled, setCustomerEnabled] = useState(false);
  const [providerEnabled, setProviderEnabled] = useState(false);
  const [enabling, setEnabling] = useState<"customer" | "provider" | null>(
    null,
  );
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    void loadAccount();
  }, []);

  async function loadAccount() {
    setLoading(true);
    setError("");

    if (getPreviewUser()) {
      setPreview(true);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Giriş yapmalısın.");
      setLoading(false);
      return;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("customer_enabled, provider_enabled")
      .eq("id", user.id)
      .single();

    if (profileError) {
      setError(
        profileError.message || "Hesap bilgileri yüklenirken bir hata oluştu.",
      );
      setLoading(false);
      return;
    }

    setCustomerEnabled(Boolean(data?.customer_enabled));
    setProviderEnabled(Boolean(data?.provider_enabled));
    setLoading(false);
  }

  async function enableAccountType(mode: "customer" | "provider") {
    if (preview || enabling) {
      return;
    }

    setEnabling(mode);
    setError("");

    const { error: rpcError } = await supabase.rpc(
      "enable_my_account_type",
      { p_mode: mode },
    );

    if (rpcError) {
      setError(
        rpcError.message || "Hesap türü etkinleştirilirken bir hata oluştu.",
      );
      setEnabling(null);
      return;
    }

    if (mode === "customer") {
      setCustomerEnabled(true);
    } else {
      setProviderEnabled(true);
    }

    window.dispatchEvent(new Event(ACTIVE_MODE_CHANGE_EVENT));
    setEnabling(null);
  }

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm font-medium text-zinc-500">Hesap</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
          Hesap türleri
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Kullanmak istediğin hesap türlerini buradan etkinleştirebilirsin.
          Aktif modun değişmez.
        </p>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>
        ) : (
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-violet-50/60 px-4 py-4">
              <div>
                <p className="text-sm font-medium text-violet-900">
                  Proje Sahibi
                </p>
                <p className="mt-1 text-xs text-violet-700/80">
                  İş ilanı yayınla ve teklif al.
                </p>
              </div>
              {customerEnabled ? (
                <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium text-violet-800">
                  Aktif
                </span>
              ) : (
                <button
                  type="button"
                  disabled={preview || enabling !== null}
                  onClick={() => void enableAccountType("customer")}
                  className="shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enabling === "customer"
                    ? "Etkinleştiriliyor..."
                    : "Proje Sahibi hesabını etkinleştir"}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-4">
              <div>
                <p className="text-sm font-medium text-emerald-900">
                  Uzman
                </p>
                <p className="mt-1 text-xs text-emerald-700/80">
                  Uygun işlere teklif ver.
                </p>
              </div>
              {providerEnabled ? (
                <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-800">
                  Aktif
                </span>
              ) : (
                <button
                  type="button"
                  disabled={preview || enabling !== null}
                  onClick={() => void enableAccountType("provider")}
                  className="shrink-0 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enabling === "provider"
                    ? "Etkinleştiriliyor..."
                    : "Uzman hesabını etkinleştir"}
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
