"use client";

import type { ReactNode } from "react";
import { IconChat } from "@/components/site/icons";
import { CHAT_HELP_LABEL, requestSiteChat } from "@/lib/chat-open";

export function ChatOpenButton({
  children = CHAT_HELP_LABEL,
  source,
  prompt,
  size = "md",
  variant = "outline",
  className = "",
}: {
  children?: ReactNode;
  source: string;
  prompt?: string;
  size?: "md" | "lg" | "compact";
  variant?: "solid" | "outline";
  className?: string;
}) {
  const sizing =
    size === "lg"
      ? "min-h-[52px] px-7 py-4 text-sm sm:text-base"
      : size === "compact"
        ? "min-h-11 px-3 py-2 text-[12px] sm:text-[13px]"
        : "min-h-[48px] px-5 py-3 text-xs sm:text-sm";
  const look =
    variant === "solid"
      ? "bg-brand text-cream hover:bg-[#c91418]"
      : "border border-white/20 text-cream hover:border-brand hover:bg-white/5";

  return (
    <button
      type="button"
      onClick={() => requestSiteChat({ source, prompt })}
      aria-label={CHAT_HELP_LABEL}
      className={`inline-flex items-center justify-center gap-2.5 font-display font-semibold normal-case tracking-normal transition touch-manipulation ${sizing} ${look} ${className}`}
    >
      <IconChat className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      {children}
    </button>
  );
}
