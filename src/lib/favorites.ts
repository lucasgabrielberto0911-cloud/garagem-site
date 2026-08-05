"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "garagem:favoritos";
const CHANGE_EVENT = "garagem:favoritos-alterados";

function read(): string[] {
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

function write(ids: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/**
 * Favoritos ficam apenas no dispositivo (localStorage), sem login. O evento
 * customizado mantém header, cards e a página /favoritos sincronizados na
 * mesma aba; `storage` cobre as outras abas.
 */
export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIds(read());
    setReady(true);

    function sync() {
      setIds(read());
    }

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

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, ready, has, toggle, remove, clear, count: ids.length };
}
