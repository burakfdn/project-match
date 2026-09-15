"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: number;
  name: string;
};

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [city, setCity] = useState("");
  const [locationType, setLocationType] = useState("remote");

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Giriş yapmalısın.");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      setError("Profil bilgileri yüklenemedi.");
      setLoading(false);
      return;
    }

    setFullName(profile.full_name ?? "");

    if (profile.role !== "provider") {
      setError("Bu sayfa yalnızca hizmet veren kullanıcılar içindir.");
      setLoading(false);
      return;
    }

    const { data: providerProfile, error: providerError } = await supabase
      .from("provider_profiles")
      .select("bio, experience_years, city, location_type")
      .eq("user_id", user.id)
      .maybeSingle();

    if (providerError) {
      setError("Provider profili yüklenemedi.");
      setLoading(false);
      return;
    }

    if (providerProfile) {
      setBio(providerProfile.bio ?? "");
      setExperienceYears(
        providerProfile.experience_years?.toString() ?? "0",
      );
      setCity(providerProfile.city ?? "");
      setLocationType(providerProfile.location_type ?? "remote");
    }

    const { data: categoryData, error: categoryError } = await supabase
      .from("categories")
      .select("id, name")
      .order("id");

    if (categoryError) {
      setError("Kategoriler yüklenemedi.");
      setLoading(false);
      return;
    }

    setCategories(categoryData ?? []);

    const { data: providerCategories, error: providerCategoriesError } =
      await supabase
        .from("provider_categories")
        .select("category_id")
        .eq("provider_id", user.id);

    if (providerCategoriesError) {
      setError("Hizmet kategorilerin yüklenemedi.");
      setLoading(false);
      return;
    }

    setSelectedCategories(
      providerCategories?.map((item) => item.category_id) ?? [],
    );

    setLoading(false);
  }

  function toggleCategory(categoryId: number) {
    setSelectedCategories((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  async function saveProfile() {
    if (!userId) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    const supabase = createClient();

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
      })
      .eq("id", userId);

    if (profileError) {
      setError("Ad soyad kaydedilemedi.");
      setSaving(false);
      return;
    }

    const { error: providerError } = await supabase
      .from("provider_profiles")
      .upsert({
        user_id: userId,
        bio: bio || null,
        experience_years: Number(experienceYears) || 0,
        city: city || null,
        location_type: locationType,
      });

    if (providerError) {
      setError("Provider profili kaydedilemedi.");
      setSaving(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from("provider_categories")
      .delete()
      .eq("provider_id", userId);

    if (deleteError) {
      setError("Hizmet kategorileri güncellenemedi.");
      setSaving(false);
      return;
    }

    if (selectedCategories.length > 0) {
      const rows = selectedCategories.map((categoryId) => ({
        provider_id: userId,
        category_id: categoryId,
      }));

      const { error: categoryInsertError } = await supabase
        .from("provider_categories")
        .insert(rows);

      if (categoryInsertError) {
        setError("Hizmet kategorileri kaydedilemedi.");
        setSaving(false);
        return;
      }
    }

    setMessage("Profil başarıyla kaydedildi.");
    setSaving(false);
  }

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-zinc-500">Profil yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <p className="text-sm font-medium text-zinc-500">
          Provider Paneli
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Profilim
        </h1>

        <p className="mt-2 text-zinc-500">
          Müşterilerin seni ve hizmetlerini daha iyi tanıyabilsin.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      <div className="space-y-6">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Temel Bilgiler</h2>

          <div className="mt-5 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Ad Soyad
              </label>

              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                placeholder="Ad Soyad"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Hakkında
              </label>

              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                placeholder="Kendinden, uzmanlığından ve yaptığın işlerden bahset..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Deneyim
              </label>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  className="w-32 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                />

                <span className="text-sm text-zinc-500">yıl</span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Şehir
              </label>

              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
                placeholder="İstanbul"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Çalışma şekli
              </label>

              <select
                value={locationType}
                onChange={(e) => setLocationType(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
              >
                <option value="remote">Uzaktan</option>
                <option value="on_site">Yerinde</option>
                <option value="hybrid">Hibrit</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Hizmet Kategorileri</h2>

          <p className="mt-1 text-sm text-zinc-500">
            Yapabileceğin hizmetleri seç. Bu kategoriler sana uygun
            işlerin belirlenmesinde kullanılacak.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {categories.map((category) => {
              const selected = selectedCategories.includes(category.id);

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={`rounded-xl border p-4 text-left text-sm font-medium transition ${
                    selected
                      ? "border-black bg-zinc-100"
                      : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </section>

        <button
          type="button"
          onClick={saveProfile}
          disabled={saving}
          className="w-full rounded-lg bg-black px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "Kaydediliyor..." : "Profili Kaydet"}
        </button>
      </div>
    </main>
  );
}