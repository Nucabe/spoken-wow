"use client";

import Link from "next/link";

import type { ContributionStatus } from "@/lib/contributions/contributions";
import type { Bucket } from "@/lib/contributions/query";
import { cn } from "@/lib/utils";

type TabsProps<T extends string> = {
  label: string;
  tabs: { value: T; label: string }[];
  active: T;
  /** The href of each tab, already localised, keeping whatever else the page is filtered to. */
  hrefFor: (value: T) => string;
  /**
   * The table's pending push, so its rows dim while the tab loads: a link to the route already
   * open gets no loading.tsx and shows nothing happening.
   */
  onGo: (href: string) => void;
  className?: string;
};

function LinkTabs<T extends string>({ label, tabs, active, hrefFor, onGo, className }: TabsProps<T>) {
  return (
    <nav aria-label={label} className={cn("mb-3 flex gap-1", className)}>
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={hrefFor(tab.value)}
          onClick={(event) => {
            // A modified click opens a tab or a window, which is the link's to do.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            onGo(hrefFor(tab.value));
          }}
          aria-current={tab.value === active ? "page" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1 text-sm",
            tab.value === active ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** Tabs rather than a filter: every row is in exactly one, and only the new ones are worked. */
export default function StatusTabs(props: Omit<TabsProps<ContributionStatus>, "label" | "tabs">) {
  return (
    <LinkTabs
      label="Status"
      tabs={[
        { value: "new", label: "New" },
        { value: "accepted", label: "Accepted" },
        { value: "rejected", label: "Rejected" },
      ]}
      {...props}
    />
  );
}

/** The New tab split by whether a row can be accepted as it stands (query.ts's bucketOf). */
export function BucketTabs({
  counts,
  ...props
}: Omit<TabsProps<Bucket>, "label" | "tabs"> & { counts: Record<Bucket, number> }) {
  return (
    <LinkTabs
      label="Bucket"
      tabs={[
        { value: "ready", label: `Ready (${counts.ready})` },
        { value: "blocked", label: `Needs a speaker (${counts.blocked})` },
      ]}
      {...props}
    />
  );
}
