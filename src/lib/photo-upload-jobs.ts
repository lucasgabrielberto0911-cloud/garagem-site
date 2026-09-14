/** Estado de envio de fotos no painel — progresso e retry, sem File no servidor. */

export type PhotoUploadStatus = "queued" | "uploading" | "done" | "error";

export type PhotoUploadJobState = {
  id: string;
  name: string;
  status: PhotoUploadStatus;
  error?: string;
};

export function summarizePhotoUploads(jobs: PhotoUploadJobState[]) {
  const total = jobs.length;
  const done = jobs.filter((job) => job.status === "done").length;
  const failed = jobs.filter((job) => job.status === "error");
  const uploading = jobs.filter((job) => job.status === "uploading").length;
  const queued = jobs.filter((job) => job.status === "queued").length;
  const processed = done + failed.length;
  const currentIndex = uploading > 0 ? processed + 1 : processed;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return {
    total,
    done,
    failed,
    uploading,
    queued,
    currentIndex: Math.min(total, Math.max(currentIndex, 0)),
    percent,
    complete: total > 0 && processed === total,
    hasFailures: failed.length > 0,
  };
}

export function retryablePhotoJobs(jobs: PhotoUploadJobState[]) {
  return jobs.filter((job) => job.status === "error");
}

export function photoUploadProgressLabel(jobs: PhotoUploadJobState[]) {
  const summary = summarizePhotoUploads(jobs);
  if (summary.total === 0) return "";
  if (summary.uploading > 0 || summary.queued > 0) {
    return `Enviando ${summary.currentIndex} de ${summary.total} foto(s)…`;
  }
  if (summary.hasFailures) {
    const ok = summary.done;
    const fail = summary.failed.length;
    return `${ok} enviada(s), ${fail} falharam. Tente de novo as que faltam.`;
  }
  return `${summary.done} foto(s) enviada(s).`;
}
