"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Na lista de estoque o card inteiro abre a ficha.
 * O atalho de WhatsApp do card fica de fora — a conversa continua na ficha,
 * na home e nos favoritos.
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
