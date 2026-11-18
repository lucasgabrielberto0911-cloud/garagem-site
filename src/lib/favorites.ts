"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "garagem:favoritos";
const CHANGE_EVENT = "garagem:favoritos-alterados";

export function readFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

const read = readFavoriteIds;

function write(ids: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/**
 * Devolve favoritos removidos (ex.: "Desfazer" depois de limpar a lista).
 * Mantém o que a pessoa salvou nesse meio tempo, na frente, e recoloca os
 * antigos na ordem original, sem duplicar.
 */
export function restoreFavoriteIds(previous: string[]): string[] {
  const current = readFavoriteIds();
  const next = [...current.filter((id) => !previous.includes(id)), ...previous];
  write(next);
  return next;
}

type FavoritesStateValue = {
  ids: string[];
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => boolean;
  remove: (id: string) => void;
  clear: () => void;
  restore: (previous: string[]) => void;
};

type FavoritesContextValue = FavoritesStateValue & {
  ready: boolean;
};

const EMPTY_IDS: string[] = [];
const FavoritesStateContext = createContext<FavoritesStateValue | null>(null);
const FavoritesReadyContext = createContext<boolean>(false);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>(EMPTY_IDS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function sync() {
      const next = read();
      setIds((prev) => {
        if (prev.length === 0 && next.length === 0) return prev;
        return next.length === 0 ? EMPTY_IDS : next;
      });
    }

    sync();
    setReady(true);

    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const current = read();
    const next = current.includes(id)
      ? current.filter((item) => item !== id)
      : [id, ...current];
    write(next);
    return next.includes(id);
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((item) => item !== id));
  }, []);

  const clear = useCallback(() => {
    write([]);
  }, []);

  const restore = useCallback((previous: string[]) => {
    restoreFavoriteIds(previous);
  }, []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  const stateValue = useMemo(
    () => ({ ids, has, toggle, remove, clear, restore, count: ids.length }),
    [ids, has, toggle, remove, clear, restore],
  );

  return createElement(
    FavoritesStateContext.Provider,
    { value: stateValue },
    createElement(FavoritesReadyContext.Provider, { value: ready }, children),
  );
}

/**
 * Lê apenas os favoritos salvos (sem assinar a transição `ready` do mount).
 * Quando não há favoritos salvos, evita re-renderizar todos os cards na hidratação.
 */
export function useFavoritesState() {
  const state = useContext(FavoritesStateContext);
  if (state) return state;

  throw new Error("useFavorites precisa de FavoritesProvider no layout público.");
}

/**
 * Favoritos ficam apenas no dispositivo (localStorage), sem login.
 * Com FavoritesProvider no layout, há um par de listeners para toda a página.
 */
export function useFavorites(): FavoritesContextValue {
  const state = useFavoritesState();
  const ready = useContext(FavoritesReadyContext);
  return useMemo(() => ({ ...state, ready }), [state, ready]);
}
