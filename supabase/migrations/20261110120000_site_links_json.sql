-- Botões da página pública /links, editáveis em Admin → Site.
-- Null = o site usa a lista padrão (src/lib/site-links.ts).
ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "linksJson" JSONB;
