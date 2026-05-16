"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Binoculars, LayoutDashboard, Server } from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Server },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="PoCWatch home"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/20"
        >
          <Binoculars className="size-5" />
        </Link>
        <div className="flex flex-col leading-tight">
          <Link
            href="/"
            className="text-2xl font-semibold tracking-tight hover:underline sm:text-3xl"
          >
            PoCWatch
          </Link>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Recent CVEs enriched with EPSS, exploit-tagged references, and public PoCs.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <nav className="flex items-center gap-1 rounded-md border bg-card p-1 text-sm">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
