"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: number;
  name: string;
  slug: string;
};

export default function ProfilePage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState("0");
  const [city, setCity] = useState("");
  const [locationType, setLocationType] = useState("remote");
 

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setUserId(user.id);

      const [{ data: profile }, { data: providerProfile }, { data: categoryData }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single(),

          supabase
            .from("provider_profiles")
            .select(
              "bio, experience_years, city, location_type,"
            )
            .eq("user_id", user.id)
            .maybeSingle(),

          supabase
            .from("categories")
            .select("id, name, slug")
            .order("name"),
        ]);

      const { data: providerCategories } = await supabase
        .from("provider_categories")
        .select("category_id")
        .eq("provider_id", user.id);

      if (profile) {
        setFullName(profile.full_name ?? "");
      }

      if (providerProfile) {
        setBio(providerProfile.bio ?? "");
        setExperienceYears(String(providerProfile.experience_years ?? 0));
        setCity(providerProfile.city ?? "");
        setLocationType(providerProfile.location_type ?? "remote");
        setMinimumBudget(
          providerProfile.minimum_budget
            ? String(providerProfile.minimum_budget)
            : ""
        );
      }

      setCategories(categoryData ?? []);
      setSelectedCategories(
        providerCategories?.map((item) => item.category_id) ?? []
      );

      setLoading(false);
    }

    loadProfile();
  }, []);

  function toggleCategory(categoryId: number) {
    setSelectedCategories((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  }

  async function handleSave() {
    if (!userId) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
      })
      .eq("id", userId);

    if (profileError) {
      setError("Temel profil bilgileri kaydedilemedi.");
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
        updated_at: new Date().toISOString(),
      });

    if (providerError) {
      setError("Hizmet veren profili kaydedilemedi.");
      setSaving(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from("provider_categories")
      .delete()
      .eq("provider_id", userId);

    if (deleteError) {
      setError("Kategoriler güncellenemedi.");
      setSaving(false);
      return;
    }

    if (selectedCategories.length > 0) {
      const rows = selectedCategories.map((categoryId) => ({
        provider_id: userId,
        category_id: categoryId,
      }));

      const { error: categoryError } = await supabase
        .from("provider_categories")
        .insert(rows);

      if (categoryError) {
        setError("Kategoriler kaydedilemedi.");
        setSaving(false);
        return;
      }
    }

    setMessage("Profilin başarıyla kaydedildi.");
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">Profil yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Hizmet Veren Profilim
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Seni doğru işlerle eşleştirebilmemiz için profilini doldur.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div>
            <label className="text-sm font-medium">Ad Soyad</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-500"
              placeholder="Ad Soyad"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Hakkında</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={5}
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-500"
              placeholder="Kendinden ve yaptığın işlerden bahset..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Deneyim (yıl)</label>
            <input
              type="number"
              min="0"
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Şehir</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-500"
              placeholder="İstanbul"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Çalışma şekli</label>
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value)}
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2"
            >
              <option value="remote">Uzaktan</option>
              <option value="on_site">Yerinde</option>
              <option value="hybrid">Hibrit</option>
            </select>
          </div>

          

          <div>
            <label className="text-sm font-medium">
              Hizmet verdiğin kategoriler
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {categories.map((category) => {
                const selected = selectedCategories.includes(category.id);

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className={`rounded-lg border p-4 text-left text-sm transition ${
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
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="text-sm text-green-600" role="status">
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-md bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : "Profili Kaydet"}
          </button>
        </div>
      </div>
    </main>
  );
}