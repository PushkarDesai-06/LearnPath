/**
 * Minimal UI primitives. Intentionally plain — the frontend will be redesigned
 * later; this is just enough to exercise the backend.
 */
"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const styles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50",
    secondary:
      "bg-gray-200 text-gray-900 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600",
    ghost: "text-blue-600 hover:underline",
  }[variant];
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium transition ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      {label ?? "Loading…"}
    </div>
  );
}

export function Badge({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: "gray" | "green" | "yellow" | "red" | "blue";
}) {
  const tones = {
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    yellow:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  }[tone];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones}`}>
      {children}
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
      <div
        className="h-2 rounded-full bg-blue-600 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{children}</p>;
}
