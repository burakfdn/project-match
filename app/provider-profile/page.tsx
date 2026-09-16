"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: number;
  name: string;
  slug: string;
};

type Service = {
  id: number;
  category_id: number;
  name: string;
};

type Profile = {
  full_name: string | null;
};

type ProviderProfile = {
  bio: string | null;
  experience_years: number;
  city: string | null;
  can_work_remote: boolean;
  can_work_on_site: boolean;
};

type WorkSample = {
  id: number;
  title: string;
  description: string | null;
  project_url: string | null;
  created_at: string;
  category_ids: number[];
};

const cities = [
  "Adana",
  "Adıyaman",
  "Afyonkarahisar",
  "Ağrı",
  "Aksaray",
  "Amasya",
  "Ankara",
  "Antalya",
  "Ardahan",
  "Artvin",
  "Aydın",
  "Balıkesir",
  "Bartın",
  "Batman",
  "Bayburt",
  "Bilecik",
  "Bingöl",
  "Bitlis",
  "Bolu",
  "Burdur",
  "Bursa",
  "Çanakkale",
  "Çankırı",
  "Çorum",
  "Denizli",
  "Diyarbakır",
  "Düzce",
  "Edirne",
  "Elazığ",
  "Erzincan",
  "Erzurum",
  "Eskişehir",
  "Gaziantep",
  "Giresun",
  "Gümüşhane",
  "Hakkari",
  "Hatay",
  "Iğdır",
  "Isparta",
  "İstanbul",
  "İzmir",
  "Kahramanmaraş",
  "Karabük",
  "Karaman",
  "Kars",
  "Kastamonu",
  "Kayseri",
  "Kilis",
  "Kırıkkale",
  "Kırklareli",
  "Kırşehir",
  "Kocaeli",
  "Konya",
  "Kütahya",
  "Malatya",
  "Manisa",
  "Mardin",
  "Mersin",
  "Muğla",
  "Muş",
  "Nevşehir",
  "Niğde",
  "Ordu",
  "Osmaniye",
  "Rize",
  "Sakarya",
  "Samsun",
  "Siirt",
  "Sinop",
  "Sivas",
  "Şanlıurfa",
  "Şırnak",
  "Tekirdağ",
  "Tokat",
  "Trabzon",
  "Tunceli",
  "Uşak",
  "Van",
  "Yalova",
  "Yozgat",
  "Zonguldak",
];

export default function ProviderProfilePage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");

  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState("0");
  const [city, setCity] = useState("");
  const [canWorkRemote, setCanWorkRemote] = useState(true);
  const [canWorkOnSite, setCanWorkOnSite] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<number[]>(
    [],
  );

  const [workSamples, setWorkSamples] = useState<WorkSample[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [workCategoryIds, setWorkCategoryIds] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingWork, setAddingWork] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Kullanıcı bulunamadı.");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const [
      profileResult,
      providerResult,
      categoriesResult,
      servicesResult,
      providerServicesResult,
      workSamplesResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single(),

      supabase
        .from("provider_profiles")
        .select(
          "bio, experience_years, city, can_work_remote, can_work_on_site",
        )
        .eq("user_id", user.id)
        .single(),

      supabase
        .from("categories")
        .select("id, name, slug")
        .order("name"),

      supabase
        .from("services")
        .select("id, category_id, name")
        .order("name"),

      supabase
        .from("provider_services")
        .select("service_id")
        .eq("provider_id", user.id),

      supabase
        .from("provider_work_samples")
        .select(
          `
            id,
            title,
            description,
            project_url,
            created_at,
            work_sample_categories (
              category_id
            )
          `,
        )
        .eq("provider_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (profileResult.data) {
      setFullName(profileResult.data.full_name ?? "");
    }

    if (providerResult.data) {
      setBio(providerResult.data.bio ?? "");
      setExperienceYears(
        String(providerResult.data.experience_years ?? 0),
      );
      setCity(providerResult.data.city ?? "");
      setCanWorkRemote(providerResult.data.can_work_remote ?? true);
      setCanWorkOnSite(providerResult.data.can_work_on_site ?? true);
    }

    setCategories(categoriesResult.data ?? []);
    setServices(servicesResult.data ?? []);

    setSelectedServices(
      (providerServicesResult.data ?? []).map(
        (item) => item.service_id,
      ),
    );

    const normalizedWorkSamples = (workSamplesResult.data ?? []).map(
      (item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        project_url: item.project_url,
        created_at: item.created_at,
        category_ids:
          item.work_sample_categories?.map(
            (category: { category_id: number }) => category.category_id,
          ) ?? [],
      }),
    );

    setWorkSamples(normalizedWorkSamples);

    if (providerResult.error) {
      const { error: insertError } = await supabase
        .from("provider_profiles")
        .insert({
          user_id: user.id,
        });

      if (insertError) {
        console.error(insertError);
      }
    }

    setLoading(false);
  }

  function toggleService(serviceId: number) {
    setSelectedServices((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  }

  function toggleWorkCategory(categoryId: number) {
    setWorkCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  async function saveProfile() {
    if (!userId) return;

    if (!fullName.trim()) {
      setError("Ad soyad alanı boş bırakılamaz.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    const { error: profileError } = await supabase.rpc(
      "update_my_profile_name",
      {
        p_full_name: fullName.trim(),
      },
    );

    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    const { error: providerError } = await supabase
      .from("provider_profiles")
      .upsert(
        {
          user_id: userId,
          bio: bio || null,
          experience_years: Number(experienceYears) || 0,
          city: city || null,
          can_work_remote: canWorkRemote,
          can_work_on_site: canWorkOnSite,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

    if (providerError) {
      setError(providerError.message);
      setSaving(false);
      return;
    }

    if (selectedServices.length === 0) {
      setError("En az bir hizmet seçmelisin.");
      setSaving(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from("provider_services")
      .delete()
      .eq("provider_id", userId);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    const { error: serviceError } = await supabase
      .from("provider_services")
      .insert(
        selectedServices.map((serviceId) => ({
          provider_id: userId,
          service_id: serviceId,
        })),
      );

    if (serviceError) {
      setError(serviceError.message);
      setSaving(false);
      return;
    }

    setMessage("Profil başarıyla kaydedildi.");
    setSaving(false);
  }

  async function addWorkSample() {
    if (!userId) return;

    if (!title.trim()) {
      setError("Çalışma başlığı gerekli.");
      return;
    }

    if (workCategoryIds.length === 0) {
      setError("En az bir hizmet alanı seç.");
      return;
    }

    setAddingWork(true);
    setMessage("");
    setError("");

    const { data: workSample, error: workError } = await supabase
      .from("provider_work_samples")
      .insert({
        provider_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        project_url: projectUrl.trim() || null,
      })
      .select("id, title, description, project_url, created_at")
      .single();

    if (workError || !workSample) {
      setError(workError?.message ?? "Çalışma eklenemedi.");
      setAddingWork(false);
      return;
    }

    const categoryRows = workCategoryIds.map((categoryId) => ({
      work_sample_id: workSample.id,
      category_id: categoryId,
    }));

    const { error: categoryError } = await supabase
      .from("work_sample_categories")
      .insert(categoryRows);

    if (categoryError) {
      await supabase
        .from("provider_work_samples")
        .delete()
        .eq("id", workSample.id);

      setError(categoryError.message);
      setAddingWork(false);
      return;
    }

    setWorkSamples((current) => [
      {
        ...workSample,
        category_ids: workCategoryIds,
      },
      ...current,
    ]);

    setTitle("");
    setDescription("");
    setProjectUrl("");
    setWorkCategoryIds([]);

    setMessage("Çalışma başarıyla eklendi.");
    setAddingWork(false);
  }

  async function deleteWorkSample(id: number) {
    setMessage("");
    setError("");

    const { error: deleteCategoriesError } = await supabase
      .from("work_sample_categories")
      .delete()
      .eq("work_sample_id", id);

    if (deleteCategoriesError) {
      setError(deleteCategoriesError.message);
      return;
    }

    const { error: deleteWorkError } = await supabase
      .from("provider_work_samples")
      .delete()
      .eq("id", id);

    if (deleteWorkError) {
      setError(deleteWorkError.message);
      return;
    }

    setWorkSamples((current) =>
      current.filter((item) => item.id !== id),
    );

    setMessage("Çalışma silindi.");
  }

  function getCategoryName(categoryId: number) {
    return (
      categories.find((category) => category.id === categoryId)?.name ??
      "Hizmet"
    );
  }

  function normalizeUrl(url: string) {
    const trimmed = url.trim();

    if (!trimmed) {
      return "";
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-muted">Yükleniyor...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <p className="mb-2 text-sm font-medium text-subtle">
            Sağlayıcı profili
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {fullName || "Profilim"}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Hizmet verdiğin alanları, deneyimini ve geçmiş çalışmalarını
            burada tanımlayabilirsin.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-8">
          {/* Genel Bilgiler */}
          <section className="rounded-2xl border border-border bg-white p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">
                Genel bilgiler
              </h2>

              <p className="mt-1 text-sm text-muted">
                Müşterilerin seni tanıması için temel bilgilerini ekle.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Ad Soyad
                </label>

                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Adınız Soyadınız"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Hakkımda
                </label>

                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={5}
                  placeholder="Kısaca kendinden ve yaptığın işlerden bahset..."
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-zinc-500"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Deneyim
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={experienceYears}
                    onChange={(event) =>
                      setExperienceYears(event.target.value)
                    }
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-zinc-500"
                  />

                  <p className="mt-2 text-xs text-subtle">Yıl</p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Şehir
                  </label>

                  <select
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-zinc-500"
                  >
                    <option value="">Şehir seç</option>

                    {cities.map((cityName) => (
                      <option key={cityName} value={cityName}>
                        {cityName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-foreground">
                  Çalışma şekli
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setCanWorkRemote(!canWorkRemote)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      canWorkRemote
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-border bg-white text-zinc-700 hover:border-zinc-400"
                    }`}
                  >
                    Uzaktan
                  </button>

                  <button
                    type="button"
                    onClick={() => setCanWorkOnSite(!canWorkOnSite)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      canWorkOnSite
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-border bg-white text-zinc-700 hover:border-zinc-400"
                    }`}
                  >
                    Yerinde
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Hizmet Alanları */}
          <section className="rounded-2xl border border-border bg-white p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">
                Hizmet alanlarım
              </h2>

              <p className="mt-1 text-sm text-muted">
                Teklif verebileceğin hizmetleri seç.
              </p>
            </div>

            <div className="space-y-7">
              {categories.map((category) => {
                const categoryServices = services.filter(
                  (service) => service.category_id === category.id,
                );

                if (categoryServices.length === 0) {
                  return null;
                }

                return (
                  <div key={category.id}>
                    <h3 className="mb-3 text-sm font-semibold text-foreground">
                      {category.name}
                    </h3>

                    <div className="flex flex-wrap gap-2">
                      {categoryServices.map((service) => {
                        const selected = selectedServices.includes(
                          service.id,
                        );

                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => toggleService(service.id)}
                            className={`rounded-full border px-4 py-2 text-sm transition ${
                              selected
                                ? "border-zinc-900 bg-zinc-900 text-white"
                                : "border-border bg-white text-zinc-700 hover:border-zinc-400"
                            }`}
                          >
                            {service.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Kaydet */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Kaydediliyor..." : "Profili Kaydet"}
            </button>
          </div>

          {/* Çalışmalarım */}
          <section className="rounded-2xl border border-border bg-white p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">
                Çalışmalarım
              </h2>

              <p className="mt-1 text-sm text-muted">
                Daha önce yaptığın işleri ve ilgili hizmet alanlarını ekle.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Çalışma adı
                </label>

                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Örn. Marka sosyal medya kampanyası"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Açıklama
                </label>

                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Bu çalışmada ne yaptığını kısaca anlat..."
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  İlgili hizmetler
                </label>

                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const selected = workCategoryIds.includes(category.id);

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => toggleWorkCategory(category.id)}
                        className={`rounded-full border px-4 py-2 text-sm transition ${
                          selected
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-border bg-white text-zinc-700 hover:border-zinc-400"
                        }`}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Proje bağlantısı
                </label>

                <input
                  value={projectUrl}
                  onChange={(event) => setProjectUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-zinc-500"
                />

                <p className="mt-2 text-xs text-subtle">
                  Çalışmanın bulunduğu web sitesi, Behance, YouTube,
                  Drive vb. bağlantıyı ekleyebilirsin.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addWorkSample}
                  disabled={addingWork}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addingWork ? "Ekleniyor..." : "Çalışma Ekle"}
                </button>
              </div>
            </div>
          </section>

          {/* Çalışma Listesi */}
          {workSamples.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Eklediğim çalışmalar
                </h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {workSamples.map((work) => {
                  const normalizedProjectUrl = work.project_url
                    ? normalizeUrl(work.project_url)
                    : "";

                  return (
                    <article
                      key={work.id}
                      className="flex min-h-[260px] flex-col rounded-2xl border border-border bg-white p-6"
                    >
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground">
                          {work.title}
                        </h3>

                        {work.description && (
                          <p className="mt-3 text-sm leading-6 text-muted">
                            {work.description}
                          </p>
                        )}

                        {work.category_ids.length > 0 && (
                          <div className="mt-5 flex flex-wrap gap-2">
                            {work.category_ids.map((categoryId) => (
                              <span
                                key={categoryId}
                                className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700"
                              >
                                {getCategoryName(categoryId)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
                        {normalizedProjectUrl ? (
                          <a
                            href={normalizedProjectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-zinc-900 underline underline-offset-4 transition hover:text-zinc-600"
                          >
                            Projeyi Görüntüle ↗
                          </a>
                        ) : (
                          <span className="text-sm text-subtle">
                            Proje bağlantısı eklenmedi
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => deleteWorkSample(work.id)}
                          className="text-sm font-medium text-red-600 transition hover:text-red-800"
                        >
                          Sil
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}