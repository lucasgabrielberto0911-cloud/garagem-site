/** Estado do “Borrar placas” no painel — progresso e resultado por foto. */

export type PhotoBlurStatus =
  | "queued"
  | "working"
  | "blurred"
  | "unchanged"
  | "error";

/** Foto marcada no admin como “tem placa” — única que pode ir ao detector. */
export function photoMarkedHasPlate(photo: { hasPlate?: boolean | null }) {
  return photo.hasPlate === true;
}

export function photosMarkedHasPlate<T extends { hasPlate?: boolean | null }>(
  photos: T[],
): T[] {
  return photos.filter(photoMarkedHasPlate);
}

export function togglePhotoHasPlate<T extends { hasPlate?: boolean | null }>(
  photo: T,
): T {
  return { ...photo, hasPlate: !photoMarkedHasPlate(photo) };
}

export function photoPlateMarkLabel(hasPlate: boolean) {
  return hasPlate ? "Tem placa" : "Tem placa?";
}

export function photoBlurEmptySelectionMessage() {
  return "Marque Tem placa nas fotos da frente ou de trás. Só essas vão ao detector — as outras não gastam API.";
}

export type PhotoBlurJobState = {
  id: string;
  status: PhotoBlurStatus;
  error?: string;
};

export function createPhotoBlurJobs(ids: string[]): PhotoBlurJobState[] {
  return ids.map((id) => ({ id, status: "queued" as const }));
}

export function summarizePhotoBlur(jobs: PhotoBlurJobState[]) {
  const total = jobs.length;
  const blurred = jobs.filter((job) => job.status === "blurred").length;
  const unchanged = jobs.filter((job) => job.status === "unchanged").length;
  const failed = jobs.filter((job) => job.status === "error");
  const working = jobs.filter((job) => job.status === "working").length;
  const queued = jobs.filter((job) => job.status === "queued").length;
  const processed = blurred + unchanged + failed.length;
  const currentIndex = working > 0 ? processed + 1 : processed;
  const percent = total === 0 ? 0 : Math.round((processed / total) * 100);

  return {
    total,
    blurred,
    unchanged,
    failed,
    working,
    queued,
    processed,
    currentIndex: Math.min(total, Math.max(currentIndex, 0)),
    percent,
    complete: total > 0 && processed === total,
    inFlight: working > 0 || queued > 0,
    hasFailures: failed.length > 0,
  };
}

export function photoBlurProgressLabel(jobs: PhotoBlurJobState[]) {
  const summary = summarizePhotoBlur(jobs);
  if (summary.total === 0) return "";
  if (summary.inFlight) {
    return `Borrando ${summary.currentIndex} de ${summary.total} foto(s)…`;
  }
  return photoBlurSummaryMessage(jobs);
}

export function photoBlurSummaryMessage(jobs: PhotoBlurJobState[]) {
  const summary = summarizePhotoBlur(jobs);
  if (summary.total === 0) return "";
  if (summary.hasFailures && summary.blurred === 0 && summary.unchanged === 0) {
    return `Não deu para borrar ${summary.failed.length} foto(s). Tente de novo.`;
  }
  if (summary.blurred === 0) {
    return summary.hasFailures
      ? `Nenhuma placa encontrada. ${summary.failed.length} foto(s) falharam.`
      : "Não achei placa nas fotos marcadas. Confira o recorte (frente/traseira) e tente de novo.";
  }
  const unchanged =
    summary.unchanged > 0 ? ` ${summary.unchanged} sem placa visível.` : "";
  const failed = summary.hasFailures
    ? ` ${summary.failed.length} falharam.`
    : "";
  return `${summary.blurred} foto(s) com placa borracha.${unchanged}${failed} Salve o anúncio para publicar.`;
}

export function photoBlurBadgeLabel(status: PhotoBlurStatus) {
  if (status === "working") return "Borrando…";
  if (status === "blurred") return "Placa borracha";
  if (status === "unchanged") return "Sem placa";
  if (status === "error") return "Falhou";
  return "Na fila";
}

export function photoBlurToastKind(jobs: PhotoBlurJobState[]) {
  const summary = summarizePhotoBlur(jobs);
  if (summary.blurred > 0) return "success" as const;
  if (summary.hasFailures && summary.unchanged === 0) return "error" as const;
  return "message" as const;
}

/** Fotos para tentar de novo: falharam ou saíram “sem placa”. */
export function photoBlurRetryIds(jobs: PhotoBlurJobState[]) {
  return jobs
    .filter((job) => job.status === "error" || job.status === "unchanged")
    .map((job) => job.id);
}

export function photoBlurNeedsSave(jobs: PhotoBlurJobState[]) {
  return jobs.some((job) => job.status === "blurred");
}
