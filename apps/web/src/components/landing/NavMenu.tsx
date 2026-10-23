"use client";

import { useRef } from "react";

const LINKS = [
  { href: "#voices", label: "What Spoken voices" },
  { href: "#manager", label: "Manager" },
  { href: "#install", label: "Install" },
  { href: "#gallery", label: "Gallery" },
  { href: "#backstage", label: "Backstage" },
  { href: "#community", label: "Community" },
];

/** The section links in a menu, for the widths where the top bar has no room for them. */
export default function NavMenu() {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (menu.current) menu.current.open = false;
  };

  return (
    <details
      ref={menu}
      className="bn-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <summary aria-label="Menu">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </summary>
      <nav aria-label="Menu">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} onClick={close}>
            {link.label}
          </a>
        ))}
      </nav>
    </details>
  );
}
