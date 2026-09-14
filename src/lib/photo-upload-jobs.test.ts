import assert from "node:assert/strict";
import { test } from "node:test";
import {
  photoUploadProgressLabel,
  retryablePhotoJobs,
  summarizePhotoUploads,
  type PhotoUploadJobState,
} from "./photo-upload-jobs";

const jobs: PhotoUploadJobState[] = [
  { id: "a", name: "frente.jpg", status: "done" },
  { id: "b", name: "lado.jpg", status: "uploading" },
  { id: "c", name: "traseira.jpg", status: "queued" },
  { id: "d", name: "painel.jpg", status: "error", error: "Falha no Storage." },
];

test("progresso conta enviadas, atual e falhas sem inventar percentual acima de 100", () => {
  const summary = summarizePhotoUploads(jobs);
  assert.equal(summary.total, 4);
  assert.equal(summary.done, 1);
  assert.equal(summary.uploading, 1);
  assert.equal(summary.queued, 1);
  assert.equal(summary.failed.length, 1);
  assert.equal(summary.currentIndex, 3);
  assert.equal(summary.percent, 25);
  assert.equal(summary.complete, false);
  assert.equal(summary.hasFailures, true);
  assert.match(photoUploadProgressLabel(jobs), /Enviando 3 de 4/);
});

test("retry devolve só as fotos que falharam", () => {
  const failed = retryablePhotoJobs(jobs);
  assert.deepEqual(
    failed.map((job) => job.id),
    ["d"],
  );
  const finished: PhotoUploadJobState[] = [
    { id: "a", name: "frente.jpg", status: "done" },
    { id: "d", name: "painel.jpg", status: "error" },
  ];
  const summary = summarizePhotoUploads(finished);
  assert.equal(summary.complete, true);
  assert.match(photoUploadProgressLabel(finished), /1 enviada/);
  assert.match(photoUploadProgressLabel(finished), /1 falharam/);
});
