"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BRAND_ICON as Brand, NAV_SECTIONS } from "@/components/nav-items";

type Props = { centerName: string; onNavigate?: () => void; footer?: React.ReactNode };

export function SidebarNav(props: Props) {
  return <SidebarNavView {...props} pathname={usePathname()} />;
}

/** Hook-free rendering, also used as the static Suspense fallback. */
export function SidebarNavView({ centerName, onNavigate, footer, pathname }: Props & { pathname: string }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 border-b px-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Brand className="size-4.5" />
        </div>
        <span className="truncate text-sm font-semibold">{centerName}</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="mb-1 px-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              {section.label}
            </p>
            <ul className="grid gap-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname !== "" && (pathname === href || pathname.startsWith(`${href}/`));
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors pointer-coarse:py-2.5",
                        active
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {label}
                      <PendingDot />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {footer && <div className="border-t p-3">{footer}</div>}
    </div>
  );
}

/** Pulses on the clicked link until its page starts rendering. */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto size-1.5 rounded-full bg-primary transition-opacity duration-200",
        pending ? "opacity-100 motion-safe:animate-pulse" : "opacity-0",
      )}
    />
  );
}
