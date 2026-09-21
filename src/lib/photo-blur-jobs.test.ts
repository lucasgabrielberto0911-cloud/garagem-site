import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPhotoBlurJobs,
  photoBlurBadgeLabel,
  photoBlurEmptySelectionMessage,
  photoBlurNeedsSave,
  photoBlurProgressLabel,
  photoBlurRetryIds,
  photoBlurSummaryMessage,
  photoBlurToastKind,
  photoMarkedHasPlate,
  photoPlateMarkLabel,
  photosMarkedHasPlate,
  summarizePhotoBlur,
  togglePhotoHasPlate,
  type PhotoBlurJobState,
} from "./photo-blur-jobs";

const jobs: PhotoBlurJobState[] = [
  { id: "a", status: "blurred" },
  { id: "b", status: "working" },
  { id: "c", status: "queued" },
  { id: "d", status: "unchanged" },
  { id: "e", status: "error", error: "Falha ao baixar." },
];

test("progresso do blur conta atual, borrachas e sem placa", () => {
  const summary = summarizePhotoBlur(jobs);
  assert.equal(summary.total, 5);
  assert.equal(summary.blurred, 1);
  assert.equal(summary.unchanged, 1);
  assert.equal(summary.failed.length, 1);
  assert.equal(summary.currentIndex, 4);
  assert.equal(summary.inFlight, true);
  assert.match(photoBlurProgressLabel(jobs), /Borrando 4 de 5/);
  assert.equal(photoBlurBadgeLabel("blurred"), "Placa borracha");
  assert.equal(photoBlurBadgeLabel("unchanged"), "Sem placa");
});

test("resumo final distingue placa borracha, sem placa e falha", () => {
  const finished: PhotoBlurJobState[] = [
    { id: "a", status: "blurred" },
    { id: "b", status: "unchanged" },
    { id: "c", status: "error" },
  ];
  assert.equal(summarizePhotoBlur(finished).complete, true);
  assert.equal(photoBlurToastKind(finished), "success");
  assert.match(photoBlurSummaryMessage(finished), /1 foto\(s\) com placa borracha/);
  assert.match(photoBlurSummaryMessage(finished), /1 sem placa visível/);
  assert.match(photoBlurSummaryMessage(finished), /1 falharam/);

  const none = createPhotoBlurJobs(["x", "y"]).map((job) => ({
    ...job,
    status: "unchanged" as const,
  }));
  assert.equal(photoBlurToastKind(none), "message");
  assert.match(photoBlurSummaryMessage(none), /Não achei placa nas fotos marcadas/);

  const failed = createPhotoBlurJobs(["z"]).map((job) => ({
    ...job,
    status: "error" as const,
  }));
  assert.equal(photoBlurToastKind(failed), "error");
});

test("só foto marcada Tem placa entra no blur", () => {
  const photos = [
    { id: "dash", url: "/painel.jpg" },
    { id: "front", url: "/frente.jpg", hasPlate: true },
    { id: "side", url: "/lado.jpg", hasPlate: false },
    { id: "rear", url: "/traseira.jpg", hasPlate: true },
  ];
  assert.equal(photoMarkedHasPlate(photos[0]), false);
  assert.deepEqual(
    photosMarkedHasPlate(photos).map((photo) => photo.id),
    ["front", "rear"],
  );
  assert.equal(photoPlateMarkLabel(false), "Tem placa?");
  assert.equal(photoPlateMarkLabel(true), "Tem placa");
  assert.equal(togglePhotoHasPlate(photos[0]).hasPlate, true);
  assert.equal(togglePhotoHasPlate(photos[1]).hasPlate, false);
  assert.match(photoBlurEmptySelectionMessage(), /não gastam API/);
});

test("retry cobre falha e sem placa; save só depois de borrar de verdade", () => {
  const finished: PhotoBlurJobState[] = [
    { id: "a", status: "blurred" },
    { id: "b", status: "unchanged" },
    { id: "c", status: "error" },
  ];
  assert.deepEqual(photoBlurRetryIds(finished), ["b", "c"]);
  assert.equal(photoBlurNeedsSave(finished), true);
  assert.equal(
    photoBlurNeedsSave([{ id: "x", status: "unchanged" }]),
    false,
  );
});
