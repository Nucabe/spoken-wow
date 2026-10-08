import { cn } from "@/lib/utils";

/** Every row of tabs on /contributions, so the sections and the status tabs read as one set. */
export const TAB_ROW = "mb-3 flex flex-wrap gap-1";

export function tabClass(active: boolean): string {
  return cn(
    "rounded-md px-2.5 py-1 text-sm",
    active ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
  );
}
