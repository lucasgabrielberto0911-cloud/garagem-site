"use client";

import { useState } from "react";
import type { FipeQuote } from "@/lib/fipe";

type Identity = { category: string; brand: string; model: string; version: string; yearModel: string; fuel: string };

export function useVehicleFipe(identity: Identity) {
  const [selection, setSelection] = useState<{ identity: Identity; quote: FipeQuote } | null>(null);
  return {
    quote: selection && Object.entries(identity).every(([key, value]) => selection.identity[key as keyof Identity] === value) ? selection.quote : null,
    remember(quote: FipeQuote) {
      const { brand, model, version, yearModel, fuel } = quote.vehicle;
      setSelection({ identity: { category: identity.category, brand, model, version, yearModel: String(yearModel), fuel }, quote });
    },
  };
}
