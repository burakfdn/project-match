"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  getPreviewUser,
  type PreviewUser,
} from "@/lib/preview";

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

function foldTurkish(value: string) {
  return value
    .replaceAll("İ", "i")
    .replaceAll("I", "ı")
    .toLocaleLowerCase("tr-TR");
}

type WorkSample = {
  id: number;
  title: string;
  description: string | null;
  projectUrl: string | null;
  categoryIds: number[];
  serviceIds: number[];
};

const TURKEY_CITIES = [
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

const inputStyle = {
  color: "#000000",
  WebkitTextFillColor: "#000000",
  backgroundColor: "#ffffff",
  opacity: 1,
};

function mapWorkSamples(
  rows:
    | Array<{
        id: number;
        title: string;
        description: string | null;
        project_url: string | null;
        work_sample_categories?:
          | { category_id: number }[]
          | { category_id: number }
          | null;
        work_sample_services?:
          | { service_id: number }[]
          | { service_id: number }
          | null;
      }>
    | null,
): WorkSample[] {
  return (rows ?? []).map((item) => {
    const categoryRows = Array.isArray(
      item.work_sample_categories,
    )
      ? item.work_sample_categories
      : item.work_sample_categories
        ? [item.work_sample_categories]
        : [];

    const serviceRows = Array.isArray(
      item.work_sample_services,
    )
      ? item.work_sample_services
      : item.work_sample_services
        ? [item.work_sample_services]
        : [];

    return {
      id: item.id,
      title: item.title,
      description: item.description,
      projectUrl: item.project_url,
      categoryIds: categoryRows.map(
        (category) => category.category_id,
      ),
      serviceIds: serviceRows.map(
        (service) => service.service_id,
      ),
    };
  });
}

export default function ProfileEditPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [previewUser, setPreviewUser] =
    useState<PreviewUser | null>(null);

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] =
    useState("");
  const [city, setCity] = useState("");

  const [canWorkRemote, setCanWorkRemote] =
    useState(true);

  const [canWorkOnSite, setCanWorkOnSite] =
    useState(true);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [services, setServices] =
    useState<Service[]>([]);

  const [selectedServices, setSelectedServices] =
    useState<number[]>([]);

  const [serviceQuery, setServiceQuery] =
    useState("");

  const [openCategoryIds, setOpenCategoryIds] =
    useState<number[]>([]);

  const [workSamples, setWorkSamples] =
    useState<WorkSample[]>([]);

  const [workTitle, setWorkTitle] =
    useState("");

  const [workDescription, setWorkDescription] =
    useState("");

  const [workProjectUrl, setWorkProjectUrl] =
    useState("");

  const [workCategoryIds, setWorkCategoryIds] =
    useState<number[]>([]);

  const [workServiceIds, setWorkServiceIds] =
    useState<number[]>([]);

  const [workCategoryPickerOpen, setWorkCategoryPickerOpen] =
    useState(false);

  const [workServicePickerOpen, setWorkServicePickerOpen] =
    useState(false);

  const [workFieldErrors, setWorkFieldErrors] = useState<{
    title?: string;
    categories?: string;
  }>({});

  const [workToast, setWorkToast] = useState<{
    title: string;
    detail: string;
  } | null>(null);

  const workTitleRef = useRef<HTMLInputElement>(null);
  const workCategoriesRef = useRef<HTMLDivElement>(null);

  const [addingWork, setAddingWork] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const isPreview = previewUser !== null;

  async function loadProfile() {
    const supabase = createClient();

    setLoading(true);
    setError(null);
    setMessage(null);

    const currentPreviewUser = getPreviewUser();

    if (currentPreviewUser) {
      setPreviewUser(currentPreviewUser);
      setUserId(currentPreviewUser.id);

      const {
        data: providerProfile,
        error: providerError,
      } = await supabase.rpc(
        "admin_preview_provider_profile",
        {
          p_user_id: currentPreviewUser.id,
        },
      );

      if (providerError) {
        console.error(providerError);
        setError("Bir hata oluştu. Lütfen tekrar deneyin.");
        setLoading(false);
        return;
      }

      const profile =
        Array.isArray(providerProfile)
          ? providerProfile[0]
          : providerProfile;

      if (!profile) {
        setError("Uzman profili bulunamadı.");
        setLoading(false);
        return;
      }

      const {
        data: categoryData,
        error: categoryError,
      } = await supabase
        .from("categories")
        .select("id, name")
        .order("id");

      if (categoryError) {
        console.error(categoryError);
        setError("Bir hata oluştu. Lütfen tekrar deneyin.");
        setLoading(false);
        return;
      }

      const {
        data: serviceData,
        error: serviceError,
      } = await supabase
        .from("services")
        .select("id, category_id, name")
        .order("category_id")
        .order("name");

      if (serviceError) {
        console.error(serviceError);
        setError("Bir hata oluştu. Lütfen tekrar deneyin.");
        setLoading(false);
        return;
      }

      const {
        data: providerServices,
        error: providerServicesError,
      } = await supabase.rpc(
        "admin_preview_provider_services",
        {
          p_user_id: currentPreviewUser.id,
        },
      );

      if (providerServicesError) {
        console.error(providerServicesError);
        setError("Bir hata oluştu. Lütfen tekrar deneyin.");
        setLoading(false);
        return;
      }

      setFullName(profile.full_name ?? "");
      setBio(profile.bio ?? "");

      setExperienceYears(
        profile.experience_years?.toString() ?? "0",
      );

      setCity(profile.city ?? "");

      setCanWorkRemote(
        profile.can_work_remote ?? true,
      );

      setCanWorkOnSite(
        profile.can_work_on_site ?? true,
      );

      setCategories(categoryData ?? []);
      setServices(serviceData ?? []);

      const previewSelectedServices =
        providerServices?.map(
          (item: { service_id: number }) =>
            item.service_id,
        ) ?? [];

      setSelectedServices(previewSelectedServices);
      setOpenCategoryIds(
        (categoryData ?? [])
          .filter((category) =>
            (serviceData ?? []).some(
              (service) =>
                service.category_id === category.id &&
                previewSelectedServices.includes(
                  service.id,
                ),
            ),
          )
          .map((category) => category.id),
      );

      const {
        data: workSamplesData,
        error: workSamplesError,
      } = await supabase
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
            ),
            work_sample_services (
              service_id
            )
          `,
        )
        .eq("provider_id", currentPreviewUser.id)
        .order("created_at", {
          ascending: false,
        });

      if (workSamplesError) {
        console.error(workSamplesError);
        setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      }

      setWorkSamples(
        mapWorkSamples(workSamplesData),
      );

      setLoading(false);
      return;
    }

    setPreviewUser(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error(userError);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setLoading(false);
      return;
    }

    if (!user) {
      setError("Giriş yapmalısın.");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("full_name, role, provider_enabled")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setLoading(false);
      return;
    }

    if (!profile) {
      setError("Profil kaydın bulunamadı.");
      setLoading(false);
      return;
    }

    if (
      !profile.provider_enabled &&
      profile.role !== "provider"
    ) {
      setError(
        "Bu sayfa yalnızca uzman kullanıcılar içindir.",
      );
      setLoading(false);
      return;
    }

    const {
      data: categoryData,
      error: categoryError,
    } = await supabase
      .from("categories")
      .select("id, name")
      .order("id");

    if (categoryError) {
      console.error(categoryError);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setLoading(false);
      return;
    }

    const {
      data: serviceData,
      error: serviceError,
    } = await supabase
      .from("services")
      .select("id, category_id, name")
      .order("category_id")
      .order("name");

    if (serviceError) {
      console.error(serviceError);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setLoading(false);
      return;
    }

    const {
      data: providerProfile,
      error: providerError,
    } = await supabase
      .from("provider_profiles")
      .select(
        "bio, experience_years, city, can_work_remote, can_work_on_site",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (providerError) {
      console.error(
        "Provider profile load error:",
        providerError,
      );
    }

    const {
      data: providerServices,
      error: providerServicesError,
    } = await supabase
      .from("provider_services")
      .select("service_id")
      .eq("provider_id", user.id);

    if (providerServicesError) {
      console.error(
        "Provider services load error:",
        providerServicesError,
      );
    }

    setFullName(profile.full_name ?? "");

    setBio(providerProfile?.bio ?? "");

    setExperienceYears(
      providerProfile?.experience_years?.toString() ??
        "0",
    );

    setCity(providerProfile?.city ?? "");

    setCanWorkRemote(
      providerProfile?.can_work_remote ?? true,
    );

    setCanWorkOnSite(
      providerProfile?.can_work_on_site ?? true,
    );

    setCategories(categoryData ?? []);
    setServices(serviceData ?? []);

    const loadedSelectedServices =
      providerServices?.map(
        (item: { service_id: number }) =>
          item.service_id,
      ) ?? [];

    setSelectedServices(loadedSelectedServices);
    setOpenCategoryIds(
      (categoryData ?? [])
        .filter((category) =>
          (serviceData ?? []).some(
            (service) =>
              service.category_id === category.id &&
              loadedSelectedServices.includes(service.id),
          ),
        )
        .map((category) => category.id),
    );

    const {
      data: workSamplesData,
      error: workSamplesError,
    } = await supabase
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
          ),
          work_sample_services (
            service_id
          )
        `,
      )
      .eq("provider_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    if (workSamplesError) {
      console.error(workSamplesError);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    }

    setWorkSamples(
      mapWorkSamples(workSamplesData),
    );

    setLoading(false);
  }

  function toggleService(serviceId: number) {
    if (isPreview) {
      return;
    }

    setSelectedServices((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  }

  function toggleCategoryOpen(categoryId: number) {
    setOpenCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  const serviceSearchNeedle = foldTurkish(serviceQuery).trim();
  const isServiceSearchActive = serviceSearchNeedle.length > 0;

  const selectedServiceItems = useMemo(
    () =>
      services.filter((service) =>
        selectedServices.includes(service.id),
      ),
    [services, selectedServices],
  );

  const portfolioCategories = useMemo(() => {
    const parentIds = new Set(
      services.map((service) => service.category_id),
    );

    if (parentIds.size === 0) {
      return categories;
    }

    return categories.filter((category) =>
      parentIds.has(category.id),
    );
  }, [categories, services]);

  function showWorkToast(title: string, detail: string) {
    setWorkToast({ title, detail });
  }

  function toggleWorkCategory(categoryId: number) {
    if (isPreview) {
      return;
    }

    const removing = workCategoryIds.includes(categoryId);

    if (removing) {
      setWorkCategoryIds((current) =>
        current.filter((id) => id !== categoryId),
      );

      setWorkServiceIds((current) =>
        current.filter((serviceId) => {
          const service = services.find(
            (item) => Number(item.id) === Number(serviceId),
          );

          return (
            !service || service.category_id !== categoryId
          );
        }),
      );

      if (workCategoryIds.length <= 1) {
        setWorkServicePickerOpen(false);
      }

      return;
    }

    setWorkCategoryIds((current) =>
      current.includes(categoryId)
        ? current
        : [...current, categoryId],
    );
    setWorkFieldErrors((current) => ({
      ...current,
      categories: undefined,
    }));
    setWorkCategoryPickerOpen(false);
  }

  function toggleWorkService(serviceId: number) {
    if (isPreview) {
      return;
    }

    const id = Number(serviceId);

    if (!Number.isFinite(id) || id <= 0) {
      return;
    }

    setWorkServiceIds((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];

      const hasRemaining = services.some(
        (service) =>
          workCategoryIds.includes(service.category_id) &&
          !next.includes(Number(service.id)),
      );

      if (!hasRemaining) {
        setWorkServicePickerOpen(false);
      }

      return next;
    });
  }

  function getCategoryName(categoryId: number) {
    return (
      categories.find(
        (category) => category.id === categoryId,
      )?.name ?? "Kategori"
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

  async function addWorkSample() {
    if (!userId || isPreview) {
      return;
    }

    if (!workTitle.trim()) {
      setWorkFieldErrors({
        title: "Proje başlığı gerekli.",
      });
      showWorkToast(
        "Çalışma kaydedilemedi",
        "Proje başlığı gerekli.",
      );
      workTitleRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      workTitleRef.current?.focus();
      return;
    }

    if (workCategoryIds.length === 0) {
      setWorkFieldErrors({
        categories: "En az bir kategori seçmelisin.",
      });
      showWorkToast(
        "Çalışma kaydedilemedi",
        "En az bir kategori seçmelisin.",
      );
      workCategoriesRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    const selectedWorkServiceIds = [
      ...new Set(
        workServiceIds
          .map((id) => Number(id))
          .filter(
            (id) => Number.isFinite(id) && id > 0,
          ),
      ),
    ];

    setAddingWork(true);
    setMessage(null);
    setWorkFieldErrors({});
    setWorkToast(null);

    const supabase = createClient();

    const { data: workSample, error: workError } =
      await supabase
        .from("provider_work_samples")
        .insert({
          provider_id: userId,
          title: workTitle.trim(),
          description:
            workDescription.trim() || null,
          project_url:
            workProjectUrl.trim() || null,
        })
        .select(
          "id, title, description, project_url, created_at",
        )
        .single();

    if (workError || !workSample) {
      showWorkToast(
        "Çalışma kaydedilemedi",
        "Çalışma kaydedilirken bir hata oluştu.",
      );
      setAddingWork(false);
      return;
    }

    const createdWorkSampleId = Number(workSample.id);

    if (!Number.isFinite(createdWorkSampleId)) {
      showWorkToast(
        "Çalışma kaydedilemedi",
        "Çalışma kaydedilirken bir hata oluştu.",
      );
      setAddingWork(false);
      return;
    }

    const categoryRows = workCategoryIds.map(
      (categoryId) => ({
        work_sample_id: createdWorkSampleId,
        category_id: Number(categoryId),
      }),
    );

    const { error: categoryError } = await supabase
      .from("work_sample_categories")
      .insert(categoryRows);

    if (categoryError) {
      await supabase
        .from("provider_work_samples")
        .delete()
        .eq("id", createdWorkSampleId);

      showWorkToast(
        "Çalışma kaydedilemedi",
        "Çalışma kaydedilirken bir hata oluştu.",
      );
      setAddingWork(false);
      return;
    }

    if (selectedWorkServiceIds.length > 0) {
      const serviceRows = selectedWorkServiceIds.map(
        (serviceId) => ({
          work_sample_id: createdWorkSampleId,
          service_id: serviceId,
        }),
      );

      const { error: serviceLinkError } =
        await supabase
          .from("work_sample_services")
          .insert(serviceRows);

      if (serviceLinkError) {
        await supabase
          .from("provider_work_samples")
          .delete()
          .eq("id", createdWorkSampleId);

        showWorkToast(
          "Çalışma kaydedilemedi",
          "Çalışma kaydedilirken bir hata oluştu.",
        );
        setAddingWork(false);
        return;
      }
    }

    setWorkSamples((current) => [
      {
        id: createdWorkSampleId,
        title: workSample.title,
        description: workSample.description,
        projectUrl: workSample.project_url,
        categoryIds: workCategoryIds,
        serviceIds: selectedWorkServiceIds,
      },
      ...current,
    ]);

    setWorkTitle("");
    setWorkDescription("");
    setWorkProjectUrl("");
    setWorkCategoryIds([]);
    setWorkServiceIds([]);
    setWorkCategoryPickerOpen(false);
    setWorkServicePickerOpen(false);
    setWorkFieldErrors({});
    setWorkToast(null);

    setMessage("Çalışma başarıyla eklendi.");
    setAddingWork(false);
  }

  async function deleteWorkSample(id: number) {
    if (isPreview) {
      return;
    }

    setMessage(null);
    setError(null);

    const supabase = createClient();

    const { error: deleteCategoriesError } =
      await supabase
        .from("work_sample_categories")
        .delete()
        .eq("work_sample_id", id);

    if (deleteCategoriesError) {
      console.error(deleteCategoriesError);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      return;
    }

    const { error: deleteWorkError } =
      await supabase
        .from("provider_work_samples")
        .delete()
        .eq("id", id);

    if (deleteWorkError) {
      console.error(deleteWorkError);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      return;
    }

    setWorkSamples((current) =>
      current.filter((item) => item.id !== id),
    );

    setMessage("Çalışma silindi.");
  }

  async function saveProfile() {
    if (!userId || isPreview) {
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    if (!canWorkRemote && !canWorkOnSite) {
      setError(
        "En az bir çalışma şeklini seçmelisin: uzaktan veya yerinde.",
      );
      setSaving(false);
      return;
    }

    if (selectedServices.length === 0) {
      setError("En az bir hizmet seçmelisin.");
      setSaving(false);
      return;
    }

    if (canWorkOnSite && !city) {
      setError(
        "Yerinde çalışabiliyorsan şehir seçmelisin.",
      );
      setSaving(false);
      return;
    }

    const supabase = createClient();

    const { error: profileError } = await supabase.rpc(
      "update_my_profile_name",
      {
        p_full_name: fullName,
      },
    );

    if (profileError) {
      console.error(profileError);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setSaving(false);
      return;
    }

    const {
      error: providerError,
    } = await supabase
      .from("provider_profiles")
      .upsert(
        {
          user_id: userId,
          bio: bio || null,
          experience_years:
            Number(experienceYears) || 0,
          city: city || null,
          can_work_remote: canWorkRemote,
          can_work_on_site: canWorkOnSite,
        },
        {
          onConflict: "user_id",
        },
      );

    if (providerError) {
      console.error(providerError);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setSaving(false);
      return;
    }

    const {
      error: deleteError,
    } = await supabase
      .from("provider_services")
      .delete()
      .eq("provider_id", userId);

    if (deleteError) {
      console.error(deleteError);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setSaving(false);
      return;
    }

    const serviceRows = selectedServices.map(
      (serviceId) => ({
        provider_id: userId,
        service_id: serviceId,
      }),
    );

    const {
      error: serviceInsertError,
    } = await supabase
      .from("provider_services")
      .insert(serviceRows);

    if (serviceInsertError) {
      console.error(serviceInsertError);
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setSaving(false);
      return;
    }

    setMessage(
      "Profil ve hizmetlerin başarıyla kaydedildi.",
    );

    setSaving(false);
    router.push("/profile");
  }

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (!workToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setWorkToast(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [workToast]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-zinc-500">
            Profil yükleniyor...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl pb-8">
        {isPreview && previewUser && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">
              Kullanıcı önizlemesi aktif.
            </span>{" "}
            Bu sayfadaki profil seçilen uzman hesabına
            göre gösteriliyor. Önizleme modunda profil
            düzenlenemez.
          </div>
        )}

        <div className="mb-8">
          <p className="text-sm font-medium text-zinc-500">
            Uzman Paneli
          </p>

          <Link
            href="/profile"
            className="mt-3 inline-block text-sm font-medium text-zinc-500 hover:text-zinc-900"
          >
            ← Profile dön
          </Link>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Profil bilgilerini düzenle
          </h1>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Proje sahipleri seni ve hizmetlerini daha iyi
            tanıyabilsin.
          </p>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Gördüğün işler hizmetlerin, çalışma şeklin ve
            (yerinde çalışıyorsan) şehrine göre eşleşir.
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

        <div className="space-y-5 sm:space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-zinc-900">
              Temel Bilgiler
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Proje sahiplerinin seni tanıması için adını
              soyadını gir.
            </p>

            <div className="mt-5">
              <label
                htmlFor="fullName"
                className="mb-2 block text-sm font-medium text-zinc-900"
              >
                Ad Soyad
              </label>

              <input
                id="fullName"
                name="fullName"
                type="text"
                value={fullName}
                onChange={(e) =>
                  setFullName(e.target.value)
                }
                autoComplete="name"
                disabled={isPreview}
                style={inputStyle}
                className="block w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black opacity-100 outline-none focus:border-zinc-500 focus:ring-0 disabled:cursor-not-allowed disabled:bg-zinc-100"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-zinc-900">
              Hakkımda
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Uzmanlığını ve çalışma tarzanı kısaca anlat.
            </p>

            <div className="mt-5">
              <label
                htmlFor="bio"
                className="mb-2 block text-sm font-medium text-zinc-900"
              >
                Hakkında
              </label>

              <textarea
                id="bio"
                name="bio"
                value={bio}
                onChange={(e) =>
                  setBio(e.target.value)
                }
                rows={5}
                disabled={isPreview}
                style={inputStyle}
                className="block w-full appearance-none resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black opacity-100 outline-none focus:border-zinc-500 focus:ring-0 disabled:cursor-not-allowed disabled:bg-zinc-100"
                placeholder="Kendinden, uzmanlığından ve yaptığın işlerden bahset..."
              />
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-zinc-900">
              Deneyim ve Konum
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Deneyim süreni ve yerinde çalışabileceğin
              şehri belirt.
            </p>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="experienceYears"
                  className="mb-2 block text-sm font-medium text-zinc-900"
                >
                  Deneyim
                </label>

                <div className="flex items-center gap-3">
                  <input
                    id="experienceYears"
                    name="experienceYears"
                    type="number"
                    min="0"
                    value={experienceYears}
                    onChange={(e) =>
                      setExperienceYears(
                        e.target.value,
                      )
                    }
                    disabled={isPreview}
                    style={inputStyle}
                    className="block w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black opacity-100 outline-none focus:border-zinc-500 focus:ring-0 disabled:cursor-not-allowed disabled:bg-zinc-100 sm:w-32"
                  />

                  <span className="shrink-0 text-sm text-zinc-500">
                    yıl
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="city"
                  className="mb-2 block text-sm font-medium text-zinc-900"
                >
                  Bulunduğun şehir
                </label>

                <select
                  id="city"
                  name="city"
                  value={city}
                  onChange={(e) =>
                    setCity(e.target.value)
                  }
                  disabled={isPreview}
                  style={inputStyle}
                  className="block w-full appearance-none rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black opacity-100 outline-none focus:border-zinc-500 focus:ring-0 disabled:cursor-not-allowed disabled:bg-zinc-100"
                >
                  <option value="">
                    Şehir seç
                  </option>

                  {TURKEY_CITIES.map((cityName) => (
                    <option
                      key={cityName}
                      value={cityName}
                    >
                      {cityName}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs text-zinc-500">
                  Yerinde çalışabileceğin işleri eşleştirmek
                  için kullanılır.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-zinc-900">
              Çalışma Şekli
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              En az bir çalışma şekli seçmelisin.
            </p>

            <div className="mt-5 space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-400">
                <input
                  type="checkbox"
                  checked={canWorkRemote}
                  onChange={(e) =>
                    setCanWorkRemote(
                      e.target.checked,
                    )
                  }
                  disabled={isPreview}
                  className="mt-0.5 h-4 w-4"
                />

                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    Uzaktan çalışabilirim
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Uzaktan yapılabilecek işleri
                    kabul edebilirim.
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-400">
                <input
                  type="checkbox"
                  checked={canWorkOnSite}
                  onChange={(e) =>
                    setCanWorkOnSite(
                      e.target.checked,
                    )
                  }
                  disabled={isPreview}
                  className="mt-0.5 h-4 w-4"
                />

                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    Yerinde çalışabilirim
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Şehir bilgime uygun yerinde
                    işleri kabul edebilirim.
                  </p>
                </div>
              </label>
            </div>

            <p className="mt-4 text-xs text-zinc-500">
              İkisini de işaretlersen hibrit ilanlara da
              uyarsın.
            </p>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-zinc-900">
              Hizmetlerim
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Yapabildiğin hizmetleri seç. Sana uygun
              ilanların belirlenmesinde bu seçimler
              kullanılacak.
            </p>

            <div className="mt-5">
              <p className="text-sm font-medium text-zinc-900">
                Seçilen hizmetler ({selectedServices.length})
              </p>

              {selectedServiceItems.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">
                  Henüz hizmet seçmedin.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedServiceItems.map((service) => (
                    <span
                      key={service.id}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
                    >
                      {service.name}
                      <button
                        type="button"
                        onClick={() =>
                          toggleService(service.id)
                        }
                        disabled={isPreview}
                        className="ml-0.5 text-zinc-400 hover:text-zinc-700 disabled:cursor-not-allowed"
                        aria-label={`${service.name} seçimini kaldır`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5">
              <input
                id="serviceSearch"
                type="search"
                value={serviceQuery}
                onChange={(event) =>
                  setServiceQuery(event.target.value)
                }
                placeholder="Hizmet ara..."
                aria-label="Hizmet ara"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </div>

            <div className="mt-4 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200">
              {categories.length === 0 ||
              services.length === 0 ? (
                <p className="px-4 py-3 text-sm text-zinc-500">
                  Seçilebilir hizmet listesi yüklenemedi.
                  Sayfayı yenileyerek tekrar dene.
                </p>
              ) : (
              categories.map((category) => {
                const categoryServices =
                  services.filter(
                    (service) =>
                      service.category_id ===
                      category.id,
                  );

                const visibleServices = isServiceSearchActive
                  ? categoryServices.filter((service) =>
                      foldTurkish(service.name).includes(
                        serviceSearchNeedle,
                      ),
                    )
                  : categoryServices;

                if (visibleServices.length === 0) {
                  return null;
                }

                const selectedCount =
                  categoryServices.filter((service) =>
                    selectedServices.includes(service.id),
                  ).length;

                const isOpen =
                  isServiceSearchActive ||
                  openCategoryIds.includes(category.id);

                return (
                  <div key={category.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (isServiceSearchActive) {
                          return;
                        }

                        toggleCategoryOpen(category.id);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span className="text-sm font-medium text-zinc-900">
                        {category.name}
                      </span>

                      <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                        {selectedCount > 0
                          ? `${selectedCount} seçili`
                          : null}
                        <span className="text-zinc-400">
                          {isOpen ? "−" : ">"}
                        </span>
                      </span>
                    </button>

                    {isOpen && (
                      <ul className="px-4 pb-3">
                        {visibleServices.map((service) => {
                          const selected =
                            selectedServices.includes(
                              service.id,
                            );

                          return (
                            <li key={service.id}>
                              <label
                                className={`flex items-center gap-2.5 rounded-md px-1 py-1.5 text-sm ${
                                  isPreview
                                    ? "cursor-not-allowed opacity-70"
                                    : "cursor-pointer hover:bg-zinc-50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() =>
                                    toggleService(
                                      service.id,
                                    )
                                  }
                                  disabled={isPreview}
                                  className="h-4 w-4 shrink-0"
                                />

                                <span
                                  className={
                                    selected
                                      ? "font-medium text-zinc-900"
                                      : "text-zinc-700"
                                  }
                                >
                                  {service.name}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })
              )}
            </div>

            {!isPreview &&
              selectedServices.length === 0 && (
                <p className="mt-5 rounded-lg bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
                  En az bir hizmet seçmelisin.
                </p>
              )}
          </section>

          {!isPreview && (
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="w-full rounded-lg bg-black px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {saving
                ? "Kaydediliyor..."
                : "Profili Kaydet"}
            </button>
          )}

        </div>
      </div>
    </main>
  );
}