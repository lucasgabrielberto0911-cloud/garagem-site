import { expect, type Page } from "@playwright/test";

export function unsavedChangesDialog(page: Page) {
  return page.getByRole("dialog", { name: "Descartar alterações?" });
}

/** Fecha o aviso de saída se ele estiver na frente do clique seguinte. */
export async function ensureNoUnsavedDialog(page: Page) {
  const dialog = unsavedChangesDialog(page);
  if (await dialog.isVisible()) {
    await dialog
      .getByRole("button", { name: "Continuar editando", exact: true })
      .click();
  }
  await expect(dialog).toHaveCount(0);
}
