import type { ReactNode } from "react";

/** Small pixel-styled pill used for rarity / status / generation tags. */
export function Badge({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-pixel text-[10px] uppercase tracking-wider ${className}`}
    >
      {children}
    </span>
  );
}
