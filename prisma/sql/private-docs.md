# Documentos privados (Storage)

Os comprovantes e documentos de veículos saem do bucket público `veiculos` e vão para o bucket **privado** `documentos`.

## No painel do Supabase

1. Storage → New bucket
2. Nome: `documentos`
3. Public bucket: **desligado**
4. File size limit: 12 MB
5. Allowed MIME: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`

O upload no painel tenta criar o bucket sozinho se a service role tiver permissão. Se o create falhar, crie manualmente com os passos acima.

## Migrar arquivos já públicos

No servidor, com as env vars do projeto:

```bash
npx tsx scripts/migrate-private-docs.ts --dry-run
npx tsx scripts/migrate-private-docs.ts
```
