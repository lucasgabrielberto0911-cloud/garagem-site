import type { ReactNode } from "react";
import {
  accessoryChipSpan,
  accessoryIconKey,
  type AccessoryIconKey,
} from "@/lib/accessory-chips";

const ICONS: Record<AccessoryIconKey, ReactNode> = {
  screen: <path d="M3 5h18v11H3zM8 20h8M12 16v4" />,
  bluetooth: <path d="m7 7 10 10-5 4V3l5 4L7 17" />,
  snow: <path d="M12 2v20M4.9 7l14.2 10M19.1 7 4.9 17" />,
  steering: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" />
      <path d="M3 12h7M14 12h7M12 14v7" />
    </>
  ),
  window: <path d="M5 20V9l9-4 5 4v11zM5 13h14" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  sensor: <path d="M4 18h4M4 12h8M4 6h12M17 18a5 5 0 0 0 4-6" />,
  camera: (
    <>
      <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  seat: <path d="M8 3l1 10h7l3 5v3M9 13l-3 8M6 21h13" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  gauge: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m12 17 4-6" />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  light: <path d="M3 8c0 6 3 9 8 9V7C7 7 3 7 3 8zM15 8h6M15 12h6M15 16h6" />,
  mirror: <path d="M3 9c0-3 4-5 9-5s9 2 9 5-4 5-9 5-9-2-9-5zM12 14v6" />,
  usb: <path d="M12 21V5M12 5l-2 2h4zM12 14l-5-3v-2M12 11l4-2v-2" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M16 7l3 3" />
    </>
  ),
  rain: <path d="M7 15a4 4 0 0 1 0-8 5 5 0 0 1 10 1 3.5 3.5 0 0 1 0 7zM8 19v2M12 19v2M16 19v2" />,
  bag: <path d="M4 8h16v12H4zM9 8V5h6v3M4 13h16" />,
  engine: <path d="M4 9h3l2-2h6v3h3v-2h2v8h-2v-2h-3v3H9l-2-2H4z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

const BASE_SPAN = { 1: "", 2: "col-span-2" } as const;
const LG_SPAN = { 1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3" } as const;

function chipSpanClass(index: number, total: number) {
  const span = accessoryChipSpan(index, total);
  return `${BASE_SPAN[span.base]} ${LG_SPAN[span.lg]}`;
}

export function VehicleAccessoryChips({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3" data-accessory-chips>
      {items.map((item, index) => (
        <li
          key={item}
          data-accessory-chip
          className={`flex min-h-[44px] items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-cream ${chipSpanClass(index, items.length)}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[18px] w-[18px] shrink-0 text-brand-light"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[accessoryIconKey(item)]}
          </svg>
          <span className="text-[13px] leading-snug sm:text-sm first-letter:uppercase">{item}</span>
        </li>
      ))}
    </ul>
  );
}
