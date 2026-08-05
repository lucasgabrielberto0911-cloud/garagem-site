export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // O JSON é montado no servidor a partir de dados próprios, sem entrada
      // livre do usuário; escapamos "<" para evitar fechamento prematuro da tag.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
