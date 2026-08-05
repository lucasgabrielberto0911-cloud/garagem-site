"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { IconEye } from "@/components/admin/icons";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Não foi possível entrar.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-asphalt px-4 py-12">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-gradient"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-24 top-1/4 h-64 w-64 rounded-full bg-brand/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-1/4 h-56 w-56 rounded-full bg-brand-orange/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/branding/logo.png"
            alt="Garagem"
            width={200}
            height={58}
            priority
            className="h-14 w-auto"
          />
          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-cream">
            Painel Admin
          </h1>
          <div className="mx-auto mt-4 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
          <p className="mt-4 text-sm text-muted">
            Entre com suas credenciais para gerenciar o estoque.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border border-white/10 bg-ink/60 p-6 backdrop-blur-sm sm:p-8"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted"
              >
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border border-white/10 bg-asphalt px-4 py-3 text-cream outline-none transition focus:border-brand"
                placeholder="admin@loja.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted"
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full border border-white/10 bg-asphalt px-4 py-3 pr-12 text-cream outline-none transition focus:border-brand"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-3 text-muted transition hover:text-cream"
                >
                  <IconEye className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-cream"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-brand py-3.5 font-display text-base font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/" className="transition hover:text-cream">
            Voltar para o site
          </Link>
        </p>
      </div>
    </main>
  );
}
