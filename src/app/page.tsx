import { Header } from "@/components/Header";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6">
        <h1 className="font-display text-4xl font-bold italic tracking-tight text-cream sm:text-5xl">
          Garagem
        </h1>
        <div className="mt-4 h-1 w-24 bg-brand-gradient" aria-hidden="true" />
        <p className="mt-6 max-w-md text-center text-muted">
          Projeto Next.js 14 pronto. Edite{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-cream">
            src/app/page.tsx
          </code>{" "}
          para começar.
        </p>
      </main>
    </>
  );
}
