/** Fotos recebidas de formulários atuais e rascunhos antigos. */
export type ReceivedAdminPhoto = string | {
  id?: string;
  url: string;
  thumbnailUrl?: string | null;
};
export type CurrentAdminPhoto = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  order: number;
};

/** Cada registro só pode ser usado uma vez; ID explícito tem precedência sobre URL. */
export function reconcileAdminPhotos(
  current: readonly CurrentAdminPhoto[],
  received: readonly ReceivedAdminPhoto[],
) {
  const byId = new Map(current.map(photo => [photo.id, photo]));
  const used = new Set<string>();
  const reserved = new Set(received.flatMap(item =>
    typeof item !== "string" && item.id && byId.has(item.id) ? [item.id] : [],
  ));
  const update: Array<CurrentAdminPhoto> = [];
  const create: Array<Omit<CurrentAdminPhoto, "id">> = [];
  received.forEach((item, order) => {
    const incoming = typeof item === "string" ? { url: item, thumbnailUrl: null } : item;
    const data = { url: incoming.url, thumbnailUrl: incoming.thumbnailUrl ?? null, order };
    const explicitId = "id" in incoming ? incoming.id : undefined;
    const match = explicitId
      ? byId.get(explicitId)
      : current.find(photo => !used.has(photo.id) && !reserved.has(photo.id) && photo.url === data.url);
    if (match && !used.has(match.id)) {
      used.add(match.id);
      // Sem mudança não exige UPDATE, mas o registro permanece preservado.
      if (match.url !== data.url || match.thumbnailUrl !== data.thumbnailUrl || match.order !== order) {
        update.push({ id: match.id, ...data });
      }
    } else {
      create.push(data);
    }
  });
  return { update, create, deleteIds: current.filter(photo => !used.has(photo.id)).map(photo => photo.id) };
}
