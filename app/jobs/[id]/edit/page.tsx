"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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

function toDatetimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (part: number) => String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EditJobPage() {
  const params = useParams();
  const router = useRouter();

  const jobId =
    typeof params.id === "string" ? params.id : "";

  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [budget, setBudget] = useState("");
  const [city, setCity] = useState("");
  const [locationType, setLocationType] = useState("remote");
  const [deadline, setDeadline] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableServices = services.filter(
    (service) => service.category_id === Number(categoryId),
  );

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      if (!jobId) {
        setCanEdit(false);
        setLoading(false);
        return;
      }

      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const [categoriesResult, servicesResult, jobResult] =
        await Promise.all([
          supabase
            .from("categories")
            .select("id, name")
            .order("name"),
          supabase
            .from("services")
            .select("id, category_id, name")
            .order("name"),
          supabase
            .from("jobs")
            .select(
              `
                id,
                customer_id,
                title,
                description,
                budget,
                city,
                location_type,
                deadline,
                status,
                service_id,
                service:services (
                  id,
                  category_id,
                  name
                )
              `,
            )
            .eq("id", jobId)
            .single(),
        ]);

      if (categoriesResult.error) {
        setError(
          `Kategoriler yüklenemedi: ${categoriesResult.error.message}`,
        );
        setCanEdit(false);
        setLoading(false);
        return;
      }

      if (servicesResult.error) {
        setError(
          `Hizmetler yüklenemedi: ${servicesResult.error.message}`,
        );
        setCanEdit(false);
        setLoading(false);
        return;
      }

      setCategories(categoriesResult.data ?? []);
      setServices(servicesResult.data ?? []);

      const job = jobResult.data;

      if (jobResult.error || !job) {
        setCanEdit(false);
        setLoading(false);
        return;
      }

      if (
        job.customer_id !== user.id ||
        job.status !== "open"
      ) {
        setCanEdit(false);
        setLoading(false);
        return;
      }

      const service = Array.isArray(job.service)
        ? job.service[0]
        : job.service;

      setTitle(job.title ?? "");
      setDescription(job.description ?? "");
      setBudget(
        job.budget !== null && job.budget !== undefined
          ? String(job.budget)
          : "",
      );
      setLocationType(job.location_type ?? "remote");
      setCity(job.city ?? "");
      setDeadline(toDatetimeLocal(job.deadline));
      setCategoryId(
        service?.category_id ? String(service.category_id) : "",
      );
      setServiceId(
        job.service_id ? String(job.service_id) : "",
      );

      setCanEdit(true);
      setLoading(false);
    }

    loadData();
  }, [jobId, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!jobId) {
      setError("Bu ilan düzenlenemiyor.");
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

    if (deadline) {
      const deadlineDate = new Date(deadline);

      if (deadlineDate <= new Date()) {
        setError("Son teklif tarihi gelecekte olmalıdır.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();

    const { error: updateError } = await supabase.rpc(
      "update_my_job",
      {
        p_job_id: Number(jobId),
        p_title: title.trim(),
        p_description: description.trim(),
        p_budget: budget ? Number(budget) : null,
        p_city: locationType === "remote" ? null : city || null,
        p_location_type: locationType,
        p_deadline: deadline
          ? new Date(deadline).toISOString()
          : null,
        p_service_id: Number(serviceId),
      },
    );

    if (updateError) {
      setError(
        updateError.message ||
          "İlan güncellenirken bir hata oluştu.",
      );
      setSaving(false);
      return;
    }

    router.push(`/jobs/${jobId}`);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">Yükleniyor...</p>
      </main>
    );
  }

  if (!canEdit) {
    return (
      <main className="min-h-screen px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            Bu ilan düzenlenemiyor.
          </div>

          {jobId ? (
            <Link
              href={`/jobs/${jobId}`}
              className="mt-6 inline-block text-sm font-medium text-zinc-700 hover:text-zinc-950"
            >
              ← İlana dön
            </Link>
          ) : (
            <Link
              href="/my-jobs"
              className="mt-6 inline-block text-sm font-medium text-zinc-700 hover:text-zinc-950"
            >
              ← İlanlarım
            </Link>
          )}
        </div>
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
            İlanı Düzenle
          </h1>

          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Açık ilanındaki bilgileri güncelleyebilirsin.
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
              onChange={(event) => setTitle(event.target.value)}
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
              onChange={(event) =>
                setDescription(event.target.value)
              }
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
              onChange={(event) => {
                setCategoryId(event.target.value);
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
              onChange={(event) => setServiceId(event.target.value)}
              disabled={!categoryId}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100"
            >
              <option value="">
                {categoryId ? "Hizmet seç" : "Önce kategori seç"}
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
                onChange={(event) => setBudget(event.target.value)}
                placeholder="Örn. 10000"
                className="w-full rounded-lg px-3 py-2.5 outline-none"
              />

              <span className="pr-3 text-sm text-zinc-500">
                TL
              </span>
            </div>
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
              onChange={(event) => {
                setLocationType(event.target.value);

                if (event.target.value === "remote") {
                  setCity("");
                }
              }}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 outline-none focus:border-zinc-500"
            >
              <option value="remote">Uzaktan</option>
              <option value="on_site">Yerinde</option>
              <option value="hybrid">Hibrit</option>
            </select>
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
                onChange={(event) => setCity(event.target.value)}
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

          <div>
            <label
              htmlFor="deadline"
              className="text-sm font-medium"
            >
              Son teklif tarihi
            </label>

            <input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2.5 outline-none focus:border-zinc-500"
            />
          </div>

          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link
              href={`/jobs/${jobId}`}
              className="rounded-lg border border-zinc-200 px-4 py-3 text-center text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              İptal
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Kaydediliyor..."
                : "Değişiklikleri Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
