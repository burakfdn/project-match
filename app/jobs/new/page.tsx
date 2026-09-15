"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: number;
  name: string;
};

export default function NewJobPage() {
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [budget, setBudget] = useState("");
  const [city, setCity] = useState("");
  const [locationType, setLocationType] = useState("remote");
  const [deadline, setDeadline] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");

      if (error) {
        setError("Kategoriler yüklenemedi.");
      } else {
        setCategories(data ?? []);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!userId) return;

    if (!title.trim() || !description.trim() || !categoryId) {
      setError("Başlık, açıklama ve kategori zorunludur.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error } = await supabase.from("jobs").insert({
      customer_id: userId,
      title: title.trim(),
      description: description.trim(),
      category_id: Number(categoryId),
      budget: budget ? Number(budget) : null,
      city: city.trim() || null,
      location_type: locationType,
      deadline: deadline ? new Date(deadline).toISOString() : null,
    });

    if (error) {
      setError("İlan oluşturulurken bir hata oluştu.");
      setSaving(false);
      return;
    }

    window.location.href = "/";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">Yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          Yeni İş İlanı
        </h1>

        <p className="mt-2 text-sm text-zinc-600">
          Yapılmasını istediğin işi anlat. Uygun profesyoneller daha sonra
          eşleştirilecek.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label className="text-sm font-medium">İş başlığı</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. Sosyal medya için 5 reels çekimi"
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium">İş açıklaması</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="İhtiyacını, beklentilerini ve varsa özel şartları anlat..."
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Kategori</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2"
            >
              <option value="">Kategori seç</option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">
              Bütçe (TL)
            </label>
            <input
              type="number"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Örn. 10000"
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Şehir</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="İstanbul"
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-500"
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
              Son teklif tarihi
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-zinc-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Yayınlanıyor..." : "İlanı Yayınla"}
          </button>
        </form>
      </div>
    </main>
  );
}