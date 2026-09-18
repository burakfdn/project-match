"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Category = {
  id: number;
  name: string;
};

type Service = {
  id: number;
  category_id: number;
  name: string;
};

const CITIES = [
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

export default function NewJobPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [userId, setUserId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [categoryId, setCategoryId] = useState("");
  const [serviceId, setServiceId] = useState("");

  const [budget, setBudget] = useState("");
  const [city, setCity] = useState("");
  const [locationType, setLocationType] = useState("remote");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableServices = services.filter(
    (service) => service.category_id === Number(categoryId),
  );

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setUserId(user.id);

      const [categoriesResult, servicesResult] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name")
          .in("id", [3, 12, 13, 14, 15, 16, 17, 18])
          .order("name"),

        supabase
          .from("services")
          .select("id, category_id, name")
          .order("name"),
      ]);

      if (categoriesResult.error) {
        setError(
          `Kategoriler yüklenemedi: ${categoriesResult.error.message}`,
        );
        setLoading(false);
        return;
      }

      if (servicesResult.error) {
        setError(
          `Hizmetler yüklenemedi: ${servicesResult.error.message}`,
        );
        setLoading(false);
        return;
      }

      setCategories(categoriesResult.data ?? []);
      setServices(servicesResult.data ?? []);

      setLoading(false);
    }

    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!userId) {
      setError("Giriş yapmalısın.");
      return;
    }

    if (!title.trim()) {
      setError("İş başlığı zorunludur.");
      return;
    }

    if (!description.trim()) {
      setError("İş açıklaması zorunludur.");
      return;
    }

    if (!categoryId) {
      setError("Kategori seçmelisin.");
      return;
    }

    if (!serviceId) {
      setError("Hizmet seçmelisin.");
      return;
    }

    if (
      (locationType === "on_site" || locationType === "hybrid") &&
      !city
    ) {
      setError(
        locationType === "on_site"
          ? "Yerinde çalışacak işler için şehir seçmelisin."
          : "Hibrit işler için şehir seçmelisin.",
      );
      return;
    }

    if (budget && Number(budget) < 0) {
      setError("Bütçe 0'dan küçük olamaz.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();

    const { error } = await supabase.from("jobs").insert({
      customer_id: userId,
      title: title.trim(),
      description: description.trim(),

      // Yeni matching sisteminin kullandığı hizmet.
      service_id: Number(serviceId),

      budget: budget ? Number(budget) : null,

      city: locationType === "remote" ? null : city || null,

      location_type: locationType,
    });

    if (error) {
      setError(
        `İlan oluşturulurken bir hata oluştu: ${error.message}`,
      );
      setSaving(false);
      return;
    }

    window.location.href = "/my-jobs";
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
        <div>
          <p className="text-sm font-medium text-zinc-500">
            Müşteri Paneli
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Yeni İş İlanı
          </h1>

          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Yapılmasını istediğin işi anlat. Hizmetine ve çalışma
            koşullarına uygun profesyoneller ilanını görebilecek.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-6"
        >
          <div>
            <label
              htmlFor="title"
              className="text-sm font-medium"
            >
              İş başlığı
            </label>

            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. Sosyal medya için 5 reels çekimi"
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2.5 outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="text-sm font-medium"
            >
              İş açıklaması
            </label>

            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="İhtiyacını, beklentilerini ve varsa özel şartları anlat..."
              className="mt-2 w-full resize-none rounded-lg border border-zinc-300 px-3 py-2.5 outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label
              htmlFor="category"
              className="text-sm font-medium"
            >
              Kategori
            </label>

            <select
              id="category"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setServiceId("");
              }}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-500"
            >
              <option value="">Kategori seç</option>

              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="service"
              className="text-sm font-medium"
            >
              Hizmet
            </label>

            <select
              id="service"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              disabled={!categoryId}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
            >
              <option value="">
                {categoryId
                  ? "Hizmet seç"
                  : "Önce kategori seç"}
              </option>

              {availableServices.map((service) => (
                <option
                  key={service.id}
                  value={service.id}
                >
                  {service.name}
                </option>
              ))}
            </select>

            <p className="mt-1.5 text-xs text-zinc-500">
              İşinin hangi hizmete ihtiyaç duyduğunu seç.
            </p>
          </div>

          <div>
            <label
              htmlFor="budget"
              className="text-sm font-medium"
            >
              Bütçe
            </label>

            <div className="mt-2 flex items-center rounded-lg border border-zinc-300 bg-white">
              <input
                id="budget"
                type="number"
                min="0"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Örn. 10000"
                className="w-full rounded-lg px-3 py-2.5 outline-none"
              />

              <span className="pr-3 text-sm text-zinc-500">
                TL
              </span>
            </div>

            <p className="mt-1.5 text-xs text-zinc-500">
              Bütçe belirtmek zorunlu değil.
            </p>
          </div>

          <div>
            <label
              htmlFor="locationType"
              className="text-sm font-medium"
            >
              Çalışma şekli
            </label>

            <select
              id="locationType"
              value={locationType}
              onChange={(e) => {
                setLocationType(e.target.value);

                if (e.target.value === "remote") {
                  setCity("");
                }
              }}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-500"
            >
              <option value="remote">Uzaktan</option>
              <option value="on_site">Yerinde</option>
              <option value="hybrid">Hibrit</option>
            </select>

            <p className="mt-1.5 text-xs text-zinc-500">
              Uzaktan işlerde şehir eşleşmesi aranmaz.
            </p>
          </div>

          {locationType !== "remote" && (
            <div>
              <label
                htmlFor="city"
                className="text-sm font-medium"
              >
                Şehir
              </label>

              <select
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-500"
              >
                <option value="">Şehir seç</option>

                {CITIES.map((cityName) => (
                  <option
                    key={cityName}
                    value={cityName}
                  >
                    {cityName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Yayınlanıyor..." : "İlanı Yayınla"}
          </button>
        </form>
      </div>
    </main>
  );
}