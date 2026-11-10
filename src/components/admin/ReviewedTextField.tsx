"use client";

import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AdminAiReview } from "./AdminAiReview";

type ReviewProps = { value?: string; defaultValue?: string; onValueChange?: (value: string) => void; reviewable: true };
type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> & ReviewProps;
type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "defaultValue" | "onChange"> & ReviewProps;

export function ReviewedInput({ value, defaultValue = "", onValueChange, reviewable, ...props }: InputProps) {
  const [local, setLocal] = useState(defaultValue);
  const text = value ?? local;
  function change(next: string) { setLocal(next); onValueChange?.(next); }
  return <div data-reviewable={reviewable} className="min-w-0"><input {...props} value={text} onChange={event => change(event.target.value)} /><AdminAiReview value={text} onApply={change} disabled={props.disabled} /></div>;
}

export function ReviewedTextarea({ value, defaultValue = "", onValueChange, reviewable, ...props }: TextareaProps) {
  const [local, setLocal] = useState(defaultValue);
  const text = value ?? local;
  function change(next: string) { setLocal(next); onValueChange?.(next); }
  return <div data-reviewable={reviewable} className="min-w-0"><textarea {...props} value={text} onChange={event => change(event.target.value)} /><AdminAiReview value={text} onApply={change} disabled={props.disabled} /></div>;
}
