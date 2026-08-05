"use client";

import { useEffect } from "react";

/**
 * Fallback extremo (erro no root layout). Precisa de html/body próprios.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0D0D0F",
          color: "#F7F5F2",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div>
          <p
            style={{
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontSize: 12,
              color: "#E8181C",
              margin: 0,
            }}
          >
            Erro
          </p>
          <h1 style={{ fontSize: 28, margin: "12px 0 0" }}>
            Algo deu errado
          </h1>
          <p style={{ color: "#9A9690", maxWidth: 420, margin: "16px auto 0" }}>
            Recarregue a página. Se o problema continuar, tente novamente em
            alguns minutos.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 28,
              background: "#E8181C",
              color: "#F7F5F2",
              border: 0,
              padding: "12px 20px",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
