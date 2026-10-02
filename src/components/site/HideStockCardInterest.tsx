"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Na lista de estoque o card inteiro abre a ficha.
 * O card não tem mais atalho de WhatsApp. Este contexto ainda esconde a
 * variante “barra” se algum botão antigo for renderizado dentro da lista.
 * O chat continua com o próprio botão.
 */
const HideStockCardInterestContext = createContext(false);

export function HideStockCardInterest({ children }: { children: ReactNode }) {
  return (
    <HideStockCardInterestContext.Provider value={true}>
      {children}
    </HideStockCardInterestContext.Provider>
  );
}

export function useHideStockCardInterest() {
  return useContext(HideStockCardInterestContext);
}
