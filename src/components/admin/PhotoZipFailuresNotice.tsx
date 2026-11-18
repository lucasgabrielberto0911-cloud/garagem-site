"use client";

import {
  formatPhotoNumber,
  type PhotoZipFailure,
} from "@/lib/admin-photo-zip";

export type PhotoZipNoticeState = {
  downloadedCount: number;
  totalCount: number;
  failures: PhotoZipFailure[];
  errorMessage?: string;
};

export function PhotoZipFailuresNotice({
  notice,
  onDismiss,
  className = "",
}: {
  notice: PhotoZipNoticeState | null;
  onDismiss: () => void;
  className?: string;
}) {
  if (!notice) return null;

  const isAllFailed = notice.downloadedCount === 0;
  const failedCount = notice.failures.length;

  const heading = isAllFailed
    ? notice.errorMessage ||
      `Não foi possível gerar o ZIP: todas as ${notice.totalCount} fotos falharam.`
    : `ZIP baixado com ${notice.downloadedCount} de ${notice.totalCount} fotos (${
        failedCount === 1 ? "1 foto falhou" : `${failedCount} fotos falharam`
      })`;

  return (
    <div
      role="alert"
      className={`border border-brand/60 bg-brand/10 px-3.5 py-3 text-sm text-cream ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-sm font-semibold text-red-300">
          {heading}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-cream/80 transition hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Fechar
        </button>
      </div>

      {!isAllFailed ? (
        <p className="mt-1 text-xs leading-relaxed text-cream/85">
          As outras fotos foram salvas em ordem e o arquivo{" "}
          <strong className="font-semibold text-cream">FALHAS.txt</strong> foi
          incluído no ZIP. Fotos com erro após nova tentativa:
        </p>
      ) : null}

      {notice.failures.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs leading-relaxed text-cream/90">
          {notice.failures.map((item) => (
            <li key={`${item.index}-${item.filename}`}>
              <span className="font-display font-semibold text-cream">
                Foto {formatPhotoNumber(item.index)}
              </span>{" "}
              <span className="text-cream/75">({item.filename})</span>:{" "}
              <span className="text-red-300">{item.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
