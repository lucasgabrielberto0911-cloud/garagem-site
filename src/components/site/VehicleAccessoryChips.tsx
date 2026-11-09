import { accessoryGroup, groupAccessories } from "@/lib/legend-parser";
import type { ReactNode } from "react";
import {
  accessoryChipSpan,
  accessoryIconKey,
  type AccessoryIconKey,
} from "@/lib/accessory-chips";

const SEAT = (
  <>
    <path d="M8 3h3a1.4 1.4 0 0 1 1.4 1.2L14 13H9L7 4.4A1.2 1.2 0 0 1 8 3z" />
    <path d="M8.5 13H17a3 3 0 0 1 3 3v2H8zM10 18v3M18 18v3" />
  </>
);

/** Mesmo traço (24x24, 1.8, pontas redondas) em todos, para o jogo ficar coeso. */
const ICONS: Record<AccessoryIconKey, ReactNode> = {
  screen: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16v4M10.5 7.5l4 2.5-4 2.5z" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  speaker: <path d="M4 9v6h4l5 4V5L8 9zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" />,
  gps: (
    <>
      <path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  bluetooth: <path d="m7 7 10 10-5 4V3l5 4L7 17" />,
  usb: (
    <>
      <path d="M12 18V5M12 5l-2 2.5h4zM12 13l-4-2.5V9M12 10l4-2.5V6" />
      <circle cx="12" cy="20" r="1.6" />
      <circle cx="8" cy="8" r="1.3" />
      <rect x="14.8" y="3.8" width="2.4" height="2.4" />
    </>
  ),
  plug: <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />,
  snow: (
    <path d="M12 2.5v19M4.2 7.2l15.6 9.6M19.8 7.2 4.2 16.8M9.5 4.7 12 7.2l2.5-2.5M9.5 19.3 12 16.8l2.5 2.5" />
  ),
  rain: <path d="M7 15a4 4 0 0 1 0-8 5 5 0 0 1 10 1 3.5 3.5 0 0 1 0 7zM8 19v2M12 19v2M16 19v2" />,
  twilight: <path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 6v3M5 10l2 2M19 10l-2 2" />,
  sunroof: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="4" />
      <rect x="8" y="6.5" width="8" height="6" rx="1" />
      <path d="M8 16.5h8" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  sensor: (
    <>
      <path d="M6.5 5.5a8 8 0 0 1 11 0M9 8a4.5 4.5 0 0 1 6 0" />
      <path d="M4 20v-4l1.6-4.2a2 2 0 0 1 1.9-1.3h9a2 2 0 0 1 1.9 1.3L20 16v4M4 16h16M7 18.2h.01M17 18.2h.01" />
    </>
  ),
  mirror: (
    <>
      <rect x="7" y="4" width="14" height="10" rx="4" />
      <path d="M9 14l-4 6h4" />
    </>
  ),
  fog: (
    <>
      <path d="M11 5a7 7 0 0 0 0 14z" />
      <path d="M15 7h6M15 12h6M15 17h6" />
    </>
  ),
  light: (
    <>
      <path d="M11 5a7 7 0 0 0 0 14z" />
      <path d="M15 8h6M15 12h6M15 16h6" />
    </>
  ),
  window: (
    <>
      <path d="M4 19V10l5-5h9a2 2 0 0 1 2 2v12z" />
      <path d="M12 16v-5M9.8 13.2 12 11l2.2 2.2" />
    </>
  ),
  windshield: (
    <path d="M3.5 18l3-10.5C7 6.5 7.7 6 9 6h6c1.3 0 2 .5 2.5 1.5l3 10.5zM7 14c3-1 7-1 10 0" />
  ),
  hill: (
    <>
      <path d="M3 19.5 21 9v10.5z" />
      <circle cx="8" cy="14.2" r="1.3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M16 7l3 3" />
    </>
  ),
  alarm: <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  isofix: (
    <>
      <circle cx="9" cy="5.5" r="2.2" />
      <path d="M5 21v-6a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v2h6v4M5 21h14" />
    </>
  ),
  airbag: (
    <>
      <circle cx="8" cy="5.5" r="2.3" />
      <path d="M4 21v-6a4 4 0 0 1 4-4" />
      <circle cx="16" cy="14" r="5" />
    </>
  ),
  cruise: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m12 17 4-6M4 17h2M18 17h2M12 9V8" />
    </>
  ),
  stability: (
    <>
      <path d="M5 12l1.5-4h11L19 12v3H5zM5 12h14" />
      <path d="M3 20c3-2 5 2 8 0s5 2 8 0" />
    </>
  ),
  brake: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 10v2.5M12 14.4v.01M5.5 6.5a8 8 0 0 0 0 11M18.5 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  steering: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M3.2 11h6.3M14.5 11h6.3M12 14.5V21" />
    </>
  ),
  handlebar: <path d="M2.5 9.5 7 8l3 4h4l3-4 4.5 1.5M12 12v6M2.5 9.5v2M21.5 9.5v2" />,
  leather: (
    <>
      {SEAT}
      <path d="M9.5 6.5 10.6 11" strokeDasharray="1.2 1.8" />
    </>
  ),
  seat: SEAT,
  wheel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 9.2V3M14.7 11.1l5.9-1.9M13.7 14.3l3.6 5M10.3 14.3l-3.6 5M9.3 11.1 3.4 9.2" />
    </>
  ),
  tire: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21" />
    </>
  ),
  dash: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6.5 14.5a3.5 3.5 0 0 1 7 0M10 14.5l1.2-2M16 10.5v4M18.5 10.5v4" />
    </>
  ),
  bag: <path d="M4 8h16v12H4zM9 8V5h6v3M4 13h16" />,
  spring: <path d="M12 3v3l-4 2 8 3-8 3 8 3-4 2v3" />,
  engine: <path d="M4 9h3l2-2h6v3h3v-2h2v8h-2v-2h-3v3H9l-2-2H4z" />,
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  swap: <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />,
  card: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10.5h18M7 15h4" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

const BASE_SPAN = { 1: "", 2: "col-span-2" } as const;
const LG_SPAN = { 1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3" } as const;

function chipSpanClass(index: number, total: number) {
  const span = accessoryChipSpan(index, total);
  return `${BASE_SPAN[span.base]} ${LG_SPAN[span.lg]}`;
}

export function VehicleAccessoryChips({ items }: { items: readonly string[] }) {
  const groups = groupAccessories(items);
  return (
    <div data-accessory-chips>
    {groups.map(({ group, items }) => <section key={group} aria-label={group} data-accessory-group={group}>
    {group !== "Outros opcionais" ? <h3 className="mt-4 font-display text-sm font-semibold text-cream">{group}</h3> : null}
    <ul className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <li
          key={item}
          data-accessory-chip={group === "Facilidades" ? undefined : ""}
          className={`flex min-h-[44px] items-center gap-2.5 sm:min-h-[52px] rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-cream ${chipSpanClass(index, items.length)}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0 text-brand-light sm:h-8 sm:w-8 sm:rounded-md sm:bg-white/[0.06] sm:p-1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[accessoryIconKey(accessoryGroup(item).text)]}
          </svg>
          <span className="text-[13px] leading-snug sm:text-sm first-letter:uppercase">{accessoryGroup(item).text}</span>
        </li>
      ))}
    </ul>
    </section>)}
    </div>
  );
}
