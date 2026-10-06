import type { Prisma } from "@prisma/client";
import { withAdminStorageLock } from "@/lib/admin-storage-lock";
import { masterObjectPathFromGalleryPath, previousObjectPathFromGalleryPath } from "@/lib/photo-master";
import { deleteStoragePublicUrls, parseStoredFileRef } from "@/lib/supabase";

/** Falha de qualquer consulta bloqueia a exclusão; nunca considera o banco vazio. */
export async function adminFileReferences(tx: Prisma.TransactionClient) {
  const [photos, costs, documents, testimonials, settings, drafts, leads] =
    await Promise.all([
      tx.photo.findMany({ select: { url: true, thumbnailUrl: true } }),
      tx.vehicleCost.findMany({ select: { receiptUrl: true } }),
      tx.vehicleDocument.findMany({ select: { fileUrl: true } }),
      tx.testimonial.findMany({ select: { photoUrl: true } }),
      tx.siteSettings.findMany({ select: { founderPhotoUrl: true } }),
      tx.adminDraft.findMany({
        where: { expiresAt: { gt: new Date() } },
        select: { photoUrls: true },
      }),
      tx.leadVenda.findMany({ select: { photoUrls: true } }),
    ]);
  const urls = [
    ...photos.flatMap((photo) => [photo.url, photo.thumbnailUrl]),
    ...costs.map((cost) => cost.receiptUrl),
    ...documents.map((doc) => doc.fileUrl),
    ...testimonials.map((item) => item.photoUrl),
    ...settings.map((item) => item.founderPhotoUrl),
    ...drafts.flatMap((item) => item.photoUrls),
    ...leads.flatMap((item) => item.photoUrls),
  ];
  const publicPaths = new Set<string>();
  const privatePaths = new Set<string>();
  for (const url of urls) {
    const ref = parseStoredFileRef(url?.split(/[?#]/)[0]);
    if (!ref) continue;
    if (ref.kind === "private") privatePaths.add(ref.path);
    else {
      publicPaths.add(ref.path);
      const master = masterObjectPathFromGalleryPath(ref.path);
      if (master) privatePaths.add(master);
      const previous = previousObjectPathFromGalleryPath(ref.path);
      if (previous) privatePaths.add(previous);
    }
  }
  return { publicPaths, privatePaths };
}

/** Também protege fotos reutilizadas e rascunhos ao remover um anúncio/arquivo. */
export async function deleteUnusedAdminFiles(
  urls: Array<string | null | undefined>,
) {
  if (!urls.some(Boolean)) return;
  try {
    await withAdminStorageLock(async (tx) => {
      const refs = await adminFileReferences(tx);
      const unused = urls.filter((url) => {
        const ref = parseStoredFileRef(url?.split(/[?#]/)[0]);
        return (
          ref &&
          !(ref.kind === "private" ? refs.privatePaths : refs.publicPaths).has(
            ref.path,
          )
        );
      });
      await deleteStoragePublicUrls(unused);
    });
  } catch (error) {
    // O registro já foi removido, mas uma falha de consulta não pode apagar anexos.
    console.error("[admin-files] exclusão adiada:", error);
  }
}
