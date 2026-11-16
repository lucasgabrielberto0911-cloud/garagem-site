"use client";

import { Suspense, lazy, useId, useState, useSyncExternalStore } from "react";
import {
  recentIdsSnapshot,
  RECENT_VEHICLES_EVENT,
  RECENT_VEHICLES_KEY,
} from "@/lib/recently-viewed";

const LazyRecentlyViewedPanel = lazy(() =>
  import("./RecentlyViewedPanel").then((module) => ({
    default: module.RecentlyViewedPanel,
  })),
);

function subscribe(changed: () => void) {
  const storage = (event: StorageEvent) => {
    if (!event.key || event.key === RECENT_VEHICLES_KEY) changed();
  };
  window.addEventListener(RECENT_VEHICLES_EVENT, changed);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(RECENT_VEHICLES_EVENT, changed);
    window.removeEventListener("storage", storage);
  };
}
const serverSnapshot = () => "";

export function RecentlyViewedVehicles() {
  const ids = useSyncExternalStore(subscribe, recentIdsSnapshot, serverSnapshot);
  const regionId = useId();
  const [open, setOpen] = useState(false);

  if (!ids) return null;
  return (
    <section data-recent-vehicles="" className="my-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-white/20 bg-ink/40 px-4 py-3 text-left text-sm font-semibold text-cream transition hover:text-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
      >
        Vistos recentemente <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <Suspense fallback={null}>
          <LazyRecentlyViewedPanel
            ids={ids}
            regionId={regionId}
            onClear={() => setOpen(false)}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
