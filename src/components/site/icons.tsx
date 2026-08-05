type IconProps = {
  className?: string;
};

const base = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconWhatsApp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.05c-.24.68-1.4 1.3-1.93 1.35-.53.05-1.02.24-3.47-.72-2.95-1.16-4.8-4.22-4.95-4.42-.14-.2-1.17-1.56-1.17-2.98s.75-2.11 1.01-2.4c.27-.29.58-.36.78-.36l.56.01c.18 0 .42-.07.65.5.24.58.82 2 .89 2.14.07.15.12.32.02.51-.1.2-.15.32-.29.49l-.44.51c-.15.14-.3.31-.13.6.17.29.75 1.24 1.61 2.01 1.11.98 2.04 1.29 2.33 1.44.29.14.46.12.63-.07.17-.2.73-.85.93-1.14.19-.29.39-.24.65-.15.27.1 1.69.8 1.98.94.29.15.48.22.55.34.07.13.07.75-.17 1.43z" />
    </svg>
  );
}

export function IconInstagram({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M16.8 7.2h.01" />
    </svg>
  );
}

export function IconPhone({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 4h4l2 5-2.5 1.5a12 12 0 006 6L15 14l5 2v4a1 1 0 01-1 1A16 16 0 013 5a1 1 0 011-1z" />
    </svg>
  );
}

export function IconMail({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

export function IconMapPin({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  );
}

export function IconCar({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 11l1.6-4.4A2 2 0 018.5 5h7a2 2 0 011.9 1.6L19 11" />
      <path d="M3 11h18v5h-2M3 11v5h2m0 0a2 2 0 104 0m-4 0h4m6 0a2 2 0 104 0m-4 0h4" />
    </svg>
  );
}

export function IconHome({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

export function IconShieldCheck({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3l7 3v6c0 4.4-3 7.9-7 9-4-1.1-7-4.6-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconClipboardCheck({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 4h6v2H9z" />
      <path d="M15 5h2a1 1 0 011 1v13a1 1 0 01-1 1H7a1 1 0 01-1-1V6a1 1 0 011-1h2" />
      <path d="M9.5 13l1.8 1.8L15 11" />
    </svg>
  );
}

export function IconGauge({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 17a8 8 0 1116 0" />
      <path d="M12 17l4-5" />
      <path d="M4 17h2M18 17h2" />
    </svg>
  );
}

export function IconFileText({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14 3H7a1 1 0 00-1 1v16a1 1 0 001 1h10a1 1 0 001-1V7z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

export function IconHandshake({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 12l4-4 3 2 2-2 2 2 3-2 4 4" />
      <path d="M7 12l3.5 3.5a2 2 0 002.8 0L17 12" />
      <path d="M3 12v3M21 12v3" />
    </svg>
  );
}

export function IconQuote({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M7.5 6C5 6 3 8 3 10.5S5 15 7.5 15c.4 0 .8 0 1.1-.1-.6 2-2.2 3.4-4.1 3.7V21c4.4-.4 7.5-4.2 7.5-9.4C12 8 10.2 6 7.5 6zm9 0C14 6 12 8 12 10.5S14 15 16.5 15c.4 0 .8 0 1.1-.1-.6 2-2.2 3.4-4.1 3.7V21c4.4-.4 7.5-4.2 7.5-9.4C21 8 19.2 6 16.5 6z" />
    </svg>
  );
}

export function IconArrowRight({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconFuel({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 21V5a2 2 0 012-2h4a2 2 0 012 2v16" />
      <path d="M6 12h8" />
      <path d="M14 8h2.5a2 2 0 012 2v6a1.5 1.5 0 003 0v-5l-2-3" />
    </svg>
  );
}

export function IconGearShift({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v16" />
      <circle cx="12" cy="4" r="1.8" />
      <path d="M6 9v3a2 2 0 002 2h8a2 2 0 002-2V9" />
      <path d="M6 9V7M18 9V7" />
    </svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconRefresh({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 12a8 8 0 0113.66-5.66L20 9" />
      <path d="M20 4v5h-5" />
      <path d="M20 12a8 8 0 01-13.66 5.66L4 15" />
      <path d="M4 20v-5h5" />
    </svg>
  );
}

export function IconShare({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" />
      <path d="M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}
