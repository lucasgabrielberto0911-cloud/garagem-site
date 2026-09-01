"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  trackLead,
  trackSearch,
  trackViewContent,
  type CatalogEventParams,
} from "@/lib/meta-pixel";

type VehicleHitProps = {
  contentId: string;
  contentName: string;
  value?: number;
  make?: string;
  model?: string;
  year?: number;
};

function catalogParams({
  contentId,
  contentName,
  value,
  make,
  model,
  year,
}: VehicleHitProps): CatalogEventParams {
  return {
    content_ids: [contentId],
    content_name: contentName,
    value,
    make,
    model,
    year,
  };
}

export function VehicleViewContent(props: VehicleHitProps) {
  const { contentId, contentName, value, make, model, year } = props;

  useEffect(() => {
    if (!contentId) return;
    trackViewContent(
      catalogParams({ contentId, contentName, value, make, model, year }),
    );
  }, [contentId, contentName, value, make, model, year]);

  return null;
}

/** Dispara Lead no clique do WhatsApp/interesse, sem atrasar o app (sem preventDefault). */
export function VehicleLeadHit({
  children,
  ...props
}: VehicleHitProps & { children: ReactNode }) {
  return (
    <span
      className="contents"
      onClickCapture={() => {
        if (!props.contentId) return;
        trackLead(catalogParams(props));
      }}
    >
      {children}
    </span>
  );
}

/**
 * Lead sem veículo do catálogo (ajuda no hero, avise-me, busca vazia).
 * `VehicleLeadHit` ignora clique sem `contentId`.
 */
export function SiteLeadHit({
  children,
  contentName,
  searchString,
}: {
  children: ReactNode;
  contentName: string;
  searchString?: string;
}) {
  return (
    <span
      className="contents"
      onClickCapture={() => {
        trackLead({
          content_ids: [],
          content_name: contentName,
          search_string: searchString,
        });
      }}
    >
      {children}
    </span>
  );
}

/** @deprecated Use VehicleLeadHit. */
export const VehicleContactHit = VehicleLeadHit;

export function StockSearchPixel({
  active,
  searchString,
  contentIds,
}: {
  active: boolean;
  searchString: string;
  contentIds: string[];
}) {
  const sentKey = useRef("");

  const idsKey = contentIds.join(",");

  useEffect(() => {
    if (!active || !searchString) return;
    const key = `${searchString}|${idsKey}`;
    if (sentKey.current === key) return;
    sentKey.current = key;
    trackSearch({
      content_ids: idsKey ? idsKey.split(",") : [],
      search_string: searchString,
    });
  }, [active, searchString, idsKey]);

  return null;
}
