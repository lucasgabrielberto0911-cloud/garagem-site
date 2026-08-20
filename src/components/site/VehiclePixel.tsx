"use client";

import { useEffect, type ReactNode } from "react";
import { trackContact, trackViewContent } from "@/lib/meta-pixel";

export function VehicleViewContent({
  contentId,
  contentName,
  value,
}: {
  contentId: string;
  contentName: string;
  value: number;
}) {
  useEffect(() => {
    trackViewContent({
      content_ids: [contentId],
      content_name: contentName,
      content_type: "vehicle",
      value,
      currency: "BRL",
    });
  }, [contentId, contentName, value]);

  return null;
}

/** Dispara Contact no clique, sem atrasar o WhatsApp (não chama preventDefault). */
export function VehicleContactHit({
  contentId,
  contentName,
  children,
}: {
  contentId: string;
  contentName: string;
  children: ReactNode;
}) {
  return (
    <span
      className="contents"
      onClickCapture={() => {
        trackContact({
          content_ids: [contentId],
          content_name: contentName,
        });
      }}
    >
      {children}
    </span>
  );
}
