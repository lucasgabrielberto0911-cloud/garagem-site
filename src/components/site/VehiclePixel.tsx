"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  trackAddToCart,
  trackLead,
  trackSearch,
  trackVehicleView,
  trackViewContent,
  type CatalogEventParams,
} from "@/lib/meta-pixel";

type VehicleHitProps = {
  contentId: string;
  contentName: string;
  slug?: string;
  value?: number;
  make?: string;
  model?: string;
  year?: number;
  stateOfVehicle?: string;
  exteriorColor?: string;
  transmission?: string;
  bodyStyle?: string;
  fuelType?: string;
  postalCode?: string;
};

function catalogParams({
  contentId,
  contentName,
  value,
  make,
  model,
  year,
  stateOfVehicle,
  exteriorColor,
  transmission,
  bodyStyle,
  fuelType,
  postalCode,
}: VehicleHitProps): CatalogEventParams {
  return {
    content_ids: [contentId],
    content_name: contentName,
    value,
    make,
    model,
    year,
    state_of_vehicle: stateOfVehicle,
    exterior_color: exteriorColor,
    transmission,
    body_style: bodyStyle,
    fuel_type: fuelType,
    postal_code: postalCode,
  };
}

export function VehicleViewContent({
  catalog = true,
  ...props
}: VehicleHitProps & { catalog?: boolean }) {
  const {
    contentId,
    contentName,
    slug,
    value,
    make,
    model,
    year,
    stateOfVehicle,
    exteriorColor,
    transmission,
    bodyStyle,
    fuelType,
    postalCode,
  } = props;

  useEffect(() => {
    if (!contentId) return;
    trackVehicleView({ vehicleId: contentId, slug });
    if (!catalog) return;
    trackViewContent(
      catalogParams({
        contentId,
        contentName,
        value,
        make,
        model,
        year,
        stateOfVehicle,
        exteriorColor,
        transmission,
        bodyStyle,
        fuelType,
        postalCode,
      }),
    );
  }, [
    catalog,
    contentId,
    contentName,
    slug,
    value,
    make,
    model,
    year,
    stateOfVehicle,
    exteriorColor,
    transmission,
    bodyStyle,
    fuelType,
    postalCode,
  ]);

  return null;
}

/**
 * WhatsApp da ficha: Lead (catálogo) e AddToCart (otimização da campanha atual).
 * Não usa preventDefault — o wa.me abre na hora. vehicle_view / whatsapp_click seguem no link.
 */
export function VehicleLeadHit({
  children,
  ...props
}: VehicleHitProps & { children: ReactNode }) {
  return (
    <span
      className="contents"
      onClickCapture={() => {
        if (!props.contentId) return;
        const params = catalogParams(props);
        trackLead(params);
        trackAddToCart(params);
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
