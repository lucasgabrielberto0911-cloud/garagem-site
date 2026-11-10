-- Desfaz 20261110120000_site_links_json: perde a lista editada em /admin/site (a /links volta ao padrão).
ALTER TABLE "SiteSettings"
  DROP COLUMN IF EXISTS "linksJson";
