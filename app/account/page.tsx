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
  const [isAdmin, setIsAdmin] = useState(false);
  const [providerDiscoverable, setProviderDiscoverable] = useState(false);
  const [savingDiscoverable, setSavingDiscoverable] = useState(false);
  const [discoverableMessage, setDiscoverableMessage] = useState("");
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
      .select(
        "customer_enabled, provider_enabled, is_admin, provider_discoverable",
      )
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
    setIsAdmin(Boolean(data?.is_admin));
    setProviderDiscoverable(Boolean(data?.provider_discoverable));
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

  async function saveDiscoverable(nextValue: boolean) {
    if (preview || savingDiscoverable || !isAdmin || !providerEnabled) {
      return;
    }

    setSavingDiscoverable(true);
    setDiscoverableMessage("");
    setError("");

    const { error: rpcError } = await supabase.rpc(
      "set_my_provider_discoverable",
      { p_discoverable: nextValue },
    );

    if (rpcError) {
      setError(
        rpcError.message || "Görünürlük ayarı kaydedilirken bir hata oluştu.",
      );
      setSavingDiscoverable(false);
      return;
    }

    setProviderDiscoverable(nextValue);
    setDiscoverableMessage("Kaydedildi.");
    setSavingDiscoverable(false);
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

        {!loading && isAdmin && providerEnabled ? (
          <div className="mt-10 rounded-2xl border border-zinc-200 bg-white px-4 py-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Uzmanlar arasında görünürlük
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Uzmanlar Keşfet sayfasında profilinin görünmesini istediğinde bu
              seçeneği açabilirsin.
            </p>

            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-zinc-700">
                {providerDiscoverable ? "Açık" : "Kapalı"}
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={providerDiscoverable}
                disabled={preview || savingDiscoverable}
                onClick={() => void saveDiscoverable(!providerDiscoverable)}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  providerDiscoverable ? "bg-zinc-900" : "bg-zinc-200"
                }`}
              >
                <span
                  className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                    providerDiscoverable ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {savingDiscoverable ? (
              <p className="mt-3 text-xs text-zinc-500">Kaydediliyor...</p>
            ) : discoverableMessage ? (
              <p className="mt-3 text-xs text-emerald-700">
                {discoverableMessage}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
