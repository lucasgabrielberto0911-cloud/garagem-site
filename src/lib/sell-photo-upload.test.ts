import test from "node:test";
import assert from "node:assert/strict";
import { prepareSellPhoto, uploadSellPhoto } from "./sell-photo-upload";
const file = new File(["photo"], "foto.webp", { type: "image/webp" });
function request(send: (xhr: XMLHttpRequest) => void) {
  const xhr = {
    upload: { onprogress: null }, status: 200, responseText: '{"url":"private-reference"}',
    open(method: string, url: string) { assert.equal(method, "POST"); assert.equal(url, "/api/vender/photos"); },
    send(body: FormData) { assert.equal((body.get("file") as File).name, "foto.webp"); send(this as unknown as XMLHttpRequest); },
    abort() { (this as unknown as XMLHttpRequest).onabort?.(event); },
  } as unknown as XMLHttpRequest;
  return xhr;
}
const event = {} as ProgressEvent;
test("preparação travada tem prazo e cancelamento antes de iniciar o transporte", async () => {
  const signal = new AbortController();
  await assert.rejects(prepareSellPhoto(file, signal.signal, () => new Promise(() => {}), 5), /demorou/);
  const pending = prepareSellPhoto(file, signal.signal, () => new Promise(() => {}), 1000);signal.abort();
  await assert.rejects(pending, { name: "AbortError" });
  await assert.rejects(prepareSellPhoto(file, signal.signal, async () => file), { name: "AbortError" });
});
test("progresso chega a 100 mas sucesso depende da confirmação da API", async () => {
  const progress: number[] = [];
  const xhr = request(x => { x.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 } as ProgressEvent);x.upload.onprogress?.({ lengthComputable: true, loaded: 10, total: 10 } as ProgressEvent);x.onload?.(event); });
  assert.equal(await uploadSellPhoto(file, new AbortController().signal, p => progress.push(p), () => xhr), "private-reference");
  assert.deepEqual(progress, [50, 100]);assert.equal(xhr.onload, null);assert.equal(xhr.upload.onprogress, null);
});
test("erro HTTP e resposta inválida nunca são tratados como foto adicionada", async () => {
  for (const response of [{ status: 429, body: '{"error":"Tente mais tarde"}', message: /Tente mais tarde/ },{ status: 200, body: '{}', message: /Não foi possível/ },{ status: 200, body: '<html>', message: /confirmar/ }]) {
    const xhr = request(x => { x.onload?.(event); });Object.assign(xhr, { status: response.status, responseText: response.body });
    await assert.rejects(uploadSellPhoto(file, new AbortController().signal, () => {}, () => xhr), response.message);
  }
});
test("rede travada e falha de conexão liberam nova tentativa", async () => {
  for (const kind of ["ontimeout", "onerror"] as const) {
    const xhr = request(x => x[kind]?.(event));
    await assert.rejects(uploadSellPhoto(file, new AbortController().signal, () => {}, () => xhr), /demorou|conexão/);
    assert.equal(xhr[kind], null);
  }
});
test("cancelar remove o listener e impede retorno de sucesso atrasado", async () => {
  const controller = new AbortController();const xhr = request(() => {});
  // O fake usa um evento simples porque Node não expõe ProgressEvent.
  xhr.abort = () => { xhr.onabort?.(event); };
  const pending = uploadSellPhoto(file, controller.signal, () => {}, () => xhr);controller.abort();
  await assert.rejects(pending, { name: "AbortError" });assert.equal(xhr.onload, null);assert.equal(xhr.onabort, null);
});
