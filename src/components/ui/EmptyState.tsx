import Link from "next/link";
import React from "react";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
};

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      {icon && (
        <div className="mb-4 text-surface-600">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-surface-300 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-surface-500 max-w-sm mb-6">{description}</p>
      )}
      {actionLabel && (actionHref ? (
        <Link
          href={actionHref}
          className="btn-primary"
        >
          {actionLabel}
        </Link>
      ) : onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="btn-primary"
        >
          {actionLabel}
        </button>
      ) : null)}
    </div>
  );
}
