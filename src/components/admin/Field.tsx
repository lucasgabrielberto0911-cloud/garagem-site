"use client";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
  type ReactElement,
} from "react";

type ControlProps = {
  id?: string;
  name?: string;
  type?: string;
  loadOptions?: unknown;
  children?: ReactNode;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};
function isControl(element: ReactElement<ControlProps>) {
  return typeof element.type === "string"
    ? ["input", "textarea", "select"].includes(element.type) &&
        element.props.type !== "hidden"
    : Boolean(element.props.loadOptions);
}
function firstControl(
  children: ReactNode,
): ReactElement<ControlProps> | undefined {
  let found: ReactElement<ControlProps> | undefined;
  Children.forEach(children, (child) => {
    if (found || !isValidElement<ControlProps>(child)) return;
    found = isControl(child) ? child : firstControl(child.props.children);
  });
  return found;
}
export function Field({
  label,
  hint,
  error,
  required = false,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  /** Use `div` when o campo tem botões internos (combobox). */
  as?: "label" | "div";
}) {
  const generated = useId();
  const target = firstControl(children);
  const id = target?.props.id || `field-${generated}`;
  const descriptionId = `${id}-help`;
  function associate(nodes: ReactNode): ReactNode {
    return Children.map(nodes, (child) => {
      if (!isValidElement<ControlProps>(child)) return child;
      if (child === target)
        return cloneElement(child, {
          id,
          "aria-invalid": Boolean(error),
          "aria-describedby":
            [
              child.props["aria-describedby"],
              error || hint ? descriptionId : null,
            ]
              .filter(Boolean)
              .join(" ") || undefined,
        });
      return child.props.children
        ? cloneElement(child, { children: associate(child.props.children) })
        : child;
    });
  }
  return (
    <div className={`block text-sm ${className}`}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-muted"
      >
        {label}
        {required ? <span className="ml-1 text-brand">*</span> : null}
      </label>
      {associate(children)}
      {error ? (
        <p
          id={descriptionId}
          role="alert"
          className="mt-1.5 text-xs text-brand"
        >
          {error}
        </p>
      ) : null}
      {!error && hint ? (
        <p id={descriptionId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
