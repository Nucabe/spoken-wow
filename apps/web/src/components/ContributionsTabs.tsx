import Link from "next/link";

import type { Section as ContributionSection } from "@/lib/contributions/query";
import { localeHref, type Lang } from "@/lib/lang";

import { TAB_ROW, tabClass } from "./tab-styles";

const SECTIONS = [
  { key: "quests", label: "Quests", href: "/contributions/quests" },
  { key: "gossip", label: "Gossip", href: "/contributions/gossip" },
  { key: "books", label: "Books", href: "/contributions/books" },
  { key: "zones", label: "Zones", href: "/contributions/zones" },
  { key: "npcs", label: "NPCs", href: "/contributions/npcs" },
] as const;

const QUEST_VIEWS = [
  { key: "contributions", label: "Contributions", href: "/contributions/quests" },
  { key: "corrections", label: "Corrections", href: "/contributions/quests/corrections" },
] as const;

type Section = ContributionSection | "npcs";
type View = (typeof QUEST_VIEWS)[number]["key"];

/**
 * The sections of /contributions, and under Quests its two views: lines the corpus lacks and
 * corrections to lines it has, which only quests can have. Links, not client state: each is
 * its own page with its own gate, and NPCs is left out for somebody that page would 404 for.
 */
export default function ContributionsTabs({
  lang,
  section,
  view,
  showNpcs,
}: {
  lang: Lang;
  section: Section;
  view?: View;
  showNpcs: boolean;
}) {
  const sections = SECTIONS.filter((tab) => tab.key !== "npcs" || showNpcs);
  return (
    <>
      <TabRow label="Contributions" lang={lang} tabs={sections} active={section} />
      {section === "quests" ? (
        <TabRow label="Quests" lang={lang} tabs={QUEST_VIEWS} active={view ?? "contributions"} />
      ) : null}
    </>
  );
}

function TabRow({
  label,
  lang,
  tabs,
  active,
}: {
  label: string;
  lang: Lang;
  tabs: readonly { key: string; label: string; href: string }[];
  active: string;
}) {
  return (
    <nav aria-label={label} className={TAB_ROW}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={localeHref(lang, tab.href)}
          aria-current={tab.key === active ? "page" : undefined}
          className={tabClass(tab.key === active)}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
