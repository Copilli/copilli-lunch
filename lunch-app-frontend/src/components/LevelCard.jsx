// src/components/LevelCard.jsx
import React from "react";

/**
 * Props:
 * - title: string (p. ej. "Preescolar")
 * - icon:  ReactNode (emoji o SVG)
 * - subtitle?: string
 * - count?: number   // alumnos u otro dato opcional
 * - selected?: boolean
 * - disabled?: boolean
 * - onClick?: () => void
 * - className?: string
 */
export default function LevelCard({
  title,
  icon = "🎒",
  subtitle,
  count,
  selected = false,
  disabled = false,
  onClick,
  className = "",
}) {
  const base =
    "card border-0 shadow-sm rounded-4 p-3 card-hover w-100 text-start";
  const state = [
    selected ? "border border-2 border-primary bg-primary-subtle" : "bg-white",
    disabled ? "opacity-50 pe-none" : "",
  ]
    .join(" ")
    .trim();

  return (
    <div
      role="button"
      aria-pressed={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) onClick?.();
      }}
      className={`${base} ${state} ${className}`}
      style={{ transition: "box-shadow .2s, transform .15s" }}
    >
      <div className="d-flex align-items-center gap-3">
        <div
          className={`rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 ${
            selected ? "bg-white" : "bg-light"
          }`}
          style={{ width: 48, height: 48, fontSize: 24 }}
          aria-hidden="true"
        >
          {icon}
        </div>

        <div className="flex-grow-1">
          <div className="d-flex align-items-center justify-content-between">
            <h3 className="h6 mb-0 fw-semibold">{title}</h3>
            {typeof count === "number" && (
              <span className="badge text-bg-secondary">{count}</span>
            )}
          </div>
          {subtitle && (
            <div className="text-muted small mt-1">{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
}
