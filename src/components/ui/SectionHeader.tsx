import Link from "next/link";
import { ArrowRight } from "lucide-react";
import React from "react";

type SectionHeaderProps = {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  href?: string;
  className?: string;
  titleClassName?: string;
  arrowOnHover?: boolean;
};

export default function SectionHeader({
  icon,
  title,
  subtitle,
  href,
  className = "",
  titleClassName = "",
  arrowOnHover = true,
}: SectionHeaderProps) {
  const titleContent = (
    <>
      {icon}
      {title}
      {arrowOnHover && href && (
        <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
      )}
    </>
  );

  return (
    <div className={`flex items-center gap-3 mb-5 ${className}`}>
      <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
      <div>
        {href ? (
          <h2 className={`text-xl sm:text-2xl font-bold text-white tracking-tight ${titleClassName}`}>
            <Link href={href} className="group inline-flex items-center gap-2 hover:text-brand-400 transition-colors duration-200">
              {titleContent}
            </Link>
          </h2>
        ) : (
          <h2 className={`text-xl sm:text-2xl font-bold text-white tracking-tight ${titleClassName}`}>
            {titleContent}
          </h2>
        )}
        {subtitle && (
          <p className="text-sm text-surface-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
