"use client";
import { cloneElement, isValidElement, useEffect, useId, useRef } from "react";
import { X, ArrowUpRight, LoaderCircle } from "lucide-react";
export function Button({
  children,
  busy = false,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={`button ${variant} ${props.className || ""}`}
    >
      {busy ? <LoaderCircle size={18} className="spin" /> : null}
      {children}
    </button>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">✧</span>
      <h3>{title}</h3>
      <p>{children || "Your next great moment starts here."}</p>
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`badge ${["CONFIRMED", "COMPLETED", "ACCEPTED", "CAPTURED", "ACTIVE", "PAID"].includes(value) ? "green" : ["CANCELLED", "DECLINED", "EXPIRED", "SUSPENDED", "REJECTED"].includes(value) ? "red" : "amber"}`}
    >
      {value.toLowerCase().replaceAll("_", " ")}
    </span>
  );
}
export function Modal({
  title,
  onClose,
  children,
  dismissible = true,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** When false, Escape, backdrop clicks and the close button are disabled. */
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
    const previous = document.activeElement as HTMLElement;
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        // The parent decides whether the dialog closes (it unmounts it).
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-title">
        <h2 id={titleId}>{title}</h2>
        {dismissible && (
          <button
            aria-label="Close dialog"
            className="icon-button"
            onClick={onClose}
          >
            <X />
          </button>
        )}
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  // Name the control by the label text only (a wrapping label would also
  // include a select's option text in its accessible name).
  const id = useId();
  const control = isValidElement<{ "aria-labelledby"?: string; "aria-label"?: string }>(children)
    ? cloneElement(children, {
        "aria-labelledby": children.props["aria-labelledby"] || (children.props["aria-label"] ? undefined : id),
      })
    : children;
  return (
    <label className={`field ${className || ""}`}>
      <span id={id}>{label}</span>
      {control}
    </label>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function CardHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Arrow() {
  return <ArrowUpRight size={18} />;
}
