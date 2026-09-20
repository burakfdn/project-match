import Link from "next/link";

const ADMIN_CARDS = [
  {
    href: "/admin/users",
    title: "Kullanıcılar",
    description: "Kullanıcı yetkilerini ve hesap durumlarını yönetin.",
  },
  {
    href: "/admin/support",
    title: "Destek Talepleri",
    description: "Kullanıcıların ilettiği destek taleplerini inceleyin.",
  },
  {
    href: "/admin/activity",
    title: "Aktivite Arşivi",
    description: "Sistemdeki önemli aksiyonları kronolojik olarak takip edin.",
  },
  {
    href: "/admin/analytics",
    title: "Analytics",
    description: "Yakında",
  },
];

export default function AdminHomePage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight"
          >
            Project Match
          </Link>

          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
            Admin Paneli
          </span>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <p className="text-sm font-medium text-zinc-500">Yönetim</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Admin Paneli
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Sistemin kullanıcılarını, destek taleplerini ve aktivitelerini
            yönetin.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {ADMIN_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-zinc-300"
            >
              <h2 className="text-lg font-semibold text-zinc-900">
                {card.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
