"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { VehicleForm as Form } from "./VehicleForm";
import type { VehicleOpsPanel as Ops } from "./VehicleOpsPanel";
import type { VehicleVerifiedPanel as Verified } from "./VehicleVerifiedPanel";

function Loading() {
  return <div role="status" aria-live="polite" className="space-y-3">
    <span className="sr-only">Carregando aba do veículo…</span>
    <div aria-hidden="true" className="skeleton h-40 w-full" />
  </div>;
}
const VehicleForm = dynamic(() => import("./VehicleForm").then(mod => mod.VehicleForm), { loading: Loading });
const VehicleOpsPanel = dynamic(() => import("./VehicleOpsPanel").then(mod => mod.VehicleOpsPanel), { loading: Loading });
const VehicleVerifiedPanel = dynamic(() => import("./VehicleVerifiedPanel").then(mod => mod.VehicleVerifiedPanel), { loading: Loading });

type Props =
  | { view: "anuncio"; panelProps: ComponentProps<typeof Form> }
  | { view: "operacao"; panelProps: ComponentProps<typeof Ops> }
  | { view: "verificado"; panelProps: ComponentProps<typeof Verified> };

/** Somente a aba renderizada solicita seu chunk; os tipos não importam código. */
export function VehicleTabsLoader(props: Props) {
  if (props.view === "operacao") return <VehicleOpsPanel {...props.panelProps} />;
  if (props.view === "verificado") return <VehicleVerifiedPanel {...props.panelProps} />;
  return <VehicleForm {...props.panelProps} />;
}
