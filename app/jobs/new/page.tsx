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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function parseJobBudget(raw: string): number | null {
  const trimmed = raw
    .trim()
    .replace(/\s/g, "")
    .replace(/₺/g, "")
    .replace(/TL/gi, "");

  if (!trimmed) {
    return null;
  }

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");

  let normalized = trimmed;

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      normalized = trimmed.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = trimmed.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    const fraction = trimmed.slice(lastComma + 1);

    if (fraction.length === 3) {
      normalized = trimmed.replace(/,/g, "");
    } else {
      normalized = trimmed.replace(",", ".");
    }
  } else if (lastDot !== -1) {
    const fraction = trimmed.slice(lastDot + 1);
    const dotCount = (trimmed.match(/\./g) ?? []).length;

    if (dotCount > 1 || fraction.length === 3) {
      normalized = trimmed.replace(/\./g, "");
    }
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

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

  const [targetProviderName, setTargetProviderName] =
    useState<string | null>(null);

  const [targetProviderId, setTargetProviderId] =
    useState<string | null>(null);

  const [targetProviderMissing, setTargetProviderMissing] =
    useState(false);

  const [targetProviderServices, setTargetProviderServices] =
    useState<Array<{ id: number; name: string }>>([]);

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
        const returnPath = `${window.location.pathname}${window.location.search}`;
        window.location.href = `/login?next=${encodeURIComponent(returnPath)}`;
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
        console.error(categoriesResult.error);
        setError("Bir hata oluştu. Lütfen tekrar deneyin.");
        setLoading(false);
        return;
      }

      if (servicesResult.error) {
        console.error(servicesResult.error);
        setError("Bir hata oluştu. Lütfen tekrar deneyin.");
        setLoading(false);
        return;
      }

      setCategories(categoriesResult.data ?? []);
      setServices(servicesResult.data ?? []);

      const providerIdParam =
        new URLSearchParams(window.location.search)
          .get("provider_id")
          ?.trim() ?? "";

      if (!providerIdParam) {
        setTargetProviderId(null);
        setTargetProviderName(null);
        setTargetProviderServices([]);
        setTargetProviderMissing(false);
      } else if (!isUuid(providerIdParam)) {
        setTargetProviderId(null);
        setTargetProviderName(null);
        setTargetProviderServices([]);
        setTargetProviderMissing(true);
        setError("Seçilen uzman bulunamadı.");
      } else {
        setTargetProviderId(providerIdParam);
        setTargetProviderMissing(false);

        const catalogServices = servicesResult.data ?? [];
        const allowedCategoryIds = new Set(
          (categoriesResult.data ?? []).map((category) => category.id),
        );

        const [providerLookup, providerServicesLookup] =
          await Promise.all([
            supabase.rpc("discover_providers"),
            supabase.rpc("discover_provider_services"),
          ]);

        if (providerLookup.error) {
          console.error(
            "Target provider lookup error:",
            providerLookup.error,
          );
          setTargetProviderName("İsimsiz Uzman");
        } else {
          const profileData = providerLookup.data;
          const profiles = (
            Array.isArray(profileData)
              ? profileData
              : profileData
                ? [profileData]
                : []
          ) as Array<{
            user_id?: string;
            full_name?: string | null;
          }>;

          const matchedProvider = profiles.find(
            (item) =>
              String(item.user_id ?? "").toLowerCase() ===
              providerIdParam.toLowerCase(),
          );

          setTargetProviderName(
            matchedProvider?.full_name?.trim() ||
              "İsimsiz Uzman",
          );
        }

        if (providerServicesLookup.error) {
          console.error(
            "Target provider services lookup error:",
            providerServicesLookup.error,
          );
          setTargetProviderServices([]);
        } else {
          const serviceData = providerServicesLookup.data;
          const serviceRows = (
            Array.isArray(serviceData)
              ? serviceData
              : serviceData
                ? [serviceData]
                : []
          ) as Array<{
            provider_id?: string;
            service_id?: number;
            service_name?: string | null;
          }>;

          const providerServices = serviceRows
            .filter(
              (row) =>
                String(row.provider_id ?? "").toLowerCase() ===
                providerIdParam.toLowerCase(),
            )
            .map((row) => ({
              id: Number(row.service_id),
              name: row.service_name?.trim() || "Hizmet",
            }))
            .filter((row) => Number.isFinite(row.id) && row.id > 0);

          setTargetProviderServices(providerServices);

          const firstMatchingService = providerServices.find((item) => {
            const catalogService = catalogServices.find(
              (service) => Number(service.id) === item.id,
            );

            return (
              catalogService !== undefined &&
              allowedCategoryIds.has(catalogService.category_id)
            );
          });

          if (firstMatchingService) {
            const catalogService = catalogServices.find(
              (service) =>
                Number(service.id) === firstMatchingService.id,
            );

            if (catalogService) {
              setCategoryId(String(catalogService.category_id));
              setServiceId(String(catalogService.id));
            }
          }
        }
      }

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

    const form = e.currentTarget as HTMLFormElement;
    const budgetField = form.elements.namedItem("budget");
    const budgetFromField =
      budgetField instanceof HTMLInputElement
        ? budgetField.value
        : "";
    const rawBudget =
      budgetFromField.trim() !== "" ? budgetFromField : budget;
    const parsedBudget = parseJobBudget(rawBudget);

    if (rawBudget.trim() !== "" && parsedBudget === null) {
      setError("Geçerli bir bütçe gir.");
      return;
    }

    if (parsedBudget !== null && parsedBudget < 0) {
      setError("Bütçe 0'dan küçük olamaz.");
      return;
    }

    if (targetProviderMissing) {
      setError("Seçilen uzman bulunamadı.");
      return;
    }

    const providerIdFromUrl =
      new URLSearchParams(window.location.search)
        .get("provider_id")
        ?.trim() ?? "";

    if (providerIdFromUrl && !targetProviderId) {
      setError("Seçilen uzman bulunamadı.");
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

      budget: parsedBudget,

      city: locationType === "remote" ? null : city || null,

      location_type: locationType,

      target_provider_id: targetProviderId,
    });

    if (error) {
      console.error(error);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setSaving(false);
      return;
    }

    window.location.href = "/my-jobs?published=1";
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
            Yapılmasını istediğin işi anlat. Kimlerin göreceğini
            hizmet, çalışma şekli ve (yerinde/hibrit) şehir belirler.
          </p>
        </div>

        {targetProviderName ? (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-sm text-zinc-500">
              Bu uzmana bildirim gider; uyan diğer uzmanlar da
              projeyi görebilir. Proje yine teklif sürecinden ilerler.
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-900">
              {targetProviderName}
            </p>

            {targetProviderServices.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-zinc-500">
                  Bu uzmanın hizmetleri
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {targetProviderServices.map((service) => (
                    <span
                      key={service.id}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700"
                    >
                      {service.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

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
                name="budget"
                type="text"
                inputMode="numeric"
                autoComplete="off"
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