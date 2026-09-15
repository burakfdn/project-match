import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-zinc-500">
            PROJECT MATCH
          </p>

          <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">
            Her iş için doğru profesyoneli bul.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
            Project Match, işin gereksinimlerine göre uygun profesyonelleri
            eşleştirir. Herkes teklif vermez. İşi yapabilecek kişiler teklif
            verir.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-zinc-950 px-5 py-3 text-sm font-medium text-white"
            >
              Ücretsiz Başla
            </Link>

            <Link
              href="/login"
              className="rounded-md border border-zinc-300 px-5 py-3 text-sm font-medium"
            >
              Giriş Yap
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}