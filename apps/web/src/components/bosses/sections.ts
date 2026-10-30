import type { ExplorerSection } from "@/components/explorer/section";
import type { InstanceFacet } from "@/lib/bosses/catalogue";
import { activeFilterCount, FIELDS, filterParams, filtersFromParams, type LineFilters } from "@/lib/bosses/filters";
import type { ResultLine } from "@/lib/bosses/search";
import { localeHref } from "@/lib/lang";
import { reportHref } from "@/lib/links";

export type BossesSection = ExplorerSection<ResultLine, LineFilters>;

/**
 * `instances` feeds the instance dropdown. Its count is the bosses with a story in the page's
 * language out of all of them, so an instance waiting to be written reads as such.
 */
export function bossesSection(instances: InstanceFacet[] = []): BossesSection {
  return {
    source: "bosses",
    api: "/api/bosses",
    textApi: "story",
    facetLabel: "Instance",
    facets: instances.map((instance) => ({
      value: instance.map,
      label: `${instance.name} (${instance.written}/${instance.count})`,
    })),
    chip: (line) => line.instanceName,
    hrefFor: (lang, line) => localeHref(lang, reportHref("bosses", line.file)),
    shortText: false,
    labels: { name: "Boss", text: "Story", search: "Search stories, bosses, instances…" },
    filters: {
      fields: FIELDS,
      kinds: [],
      fromParams: filtersFromParams,
      toParams: filterParams,
      activeCount: activeFilterCount,
    },
  };
}
