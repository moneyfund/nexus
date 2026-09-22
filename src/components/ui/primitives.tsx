"use client";
import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, X, Orbit, Plus } from "lucide-react";
const subscribeToClient = () => () => {};
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button {...props} className={`button button-${variant} ${className}`}>
      {children}
    </button>
  );
}
export function IconButton({
  children,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      title={label}
      aria-label={label}
      className={"icon-button " + (props.className ?? "")}
    >
      {children}
    </button>
  );
}
export function Label({ children }: { children: ReactNode }) {
  return <div className="hud-label">{children}</div>;
}
export function Badge({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <span className={"badge " + (active ? "badge-active" : "")}>
      {children}
    </span>
  );
}
export function ModuleFrame({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="module-frame">
      <header className="module-heading">
        <div>
          <Label>{eyebrow}</Label>
          <h1>
            {title}
            <span className="title-period">.</span>
          </h1>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}
export function SectionHeading({
  number,
  label,
  title,
  action,
}: {
  number?: string;
  label: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <Label>
          {number && <span className="section-number">{number}</span>}
          {label}
        </Label>
        {title && <h2>{title}</h2>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title = "Aquí empieza algo nuevo.",
  text,
  onAction,
  action = "Capturar",
}: {
  title?: string;
  text: string;
  onAction?: () => void;
  action?: string;
}) {
  return (
    <div className="empty-state">
      <Orbit size={32} strokeWidth={1} />
      <h3>{title}</h3>
      <p>{text}</p>
      {onAction && (
        <Button variant="secondary" onClick={onAction}>
          <Plus size={15} />
          {action}
        </Button>
      )}
    </div>
  );
}
export function ProgressRing({
  value,
  size = 120,
  label,
  caption,
}: {
  value: number;
  size?: number;
  label?: string;
  caption?: string;
}) {
  const progress = Math.max(0, Math.min(100, value));
  return (
    <div
      className="progress-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${caption ?? "Progreso"}: ${progress}%`}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="53" className="ring-track" />
        <circle
          cx="60"
          cy="60"
          r="53"
          className="ring-value"
          pathLength="100"
          strokeDasharray={`${progress} 100`}
        />
      </svg>
      <span>
        <strong>{label ?? progress + "%"}</strong>
        {caption && <small>{caption}</small>}
      </span>
    </div>
  );
}
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label = "Vista",
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; icon?: ReactNode }[];
  label?: string;
}) {
  return (
    <div className="tabs" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          aria-pressed={value === item.value}
          className={value === item.value ? "active" : ""}
          onClick={() => onChange(item.value)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  full = false,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  full?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const mounted = useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false,
  );
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open, mounted]);
  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${wide ? "modal-wide" : ""} ${full ? "modal-full" : ""} ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !full) onClose();
      }}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <div>
            <Label>
              NEXUS / {full ? "FOCUS ENVIRONMENT" : "CONTEXT LAYER"}
            </Label>
            <h2 id={titleId}>{title}</h2>
          </div>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={19} />
          </IconButton>
        </div>
        {open && children}
      </div>
    </dialog>,
    document.body,
  );
}
export function DataMetric({
  label,
  value,
  meta,
}: {
  label: string;
  value: ReactNode;
  meta?: string;
}) {
  return (
    <div className="data-metric">
      <Label>{label}</Label>
      <strong>{value}</strong>
      {meta && <span>{meta}</span>}
    </div>
  );
}
export function ArrowLink({ children }: { children: ReactNode }) {
  return (
    <span className="inline-arrow">
      {children}
      <ArrowUpRight size={15} />
    </span>
  );
}
