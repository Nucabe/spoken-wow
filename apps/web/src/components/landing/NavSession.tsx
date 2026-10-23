"use client";

import Link from "@/components/LocaleLink";
import { useSession } from "@/lib/auth-client";

import { BACKSTAGE_HREF } from "./backstage";

/** The top bar's sign-in button, or the way into Backstage once there is a session. */
export default function NavSession() {
  const { data: session, isPending } = useSession();
  if (isPending) {
    return (
      <span className="bn-btn bn-btn-sm" aria-hidden="true" style={{ visibility: "hidden" }}>
        Backstage
      </span>
    );
  }
  return session ? (
    <Link className="bn-btn bn-btn-primary bn-btn-sm" href={BACKSTAGE_HREF}>
      Backstage
    </Link>
  ) : (
    <a className="bn-btn bn-btn-primary bn-btn-sm" href="#backstage">
      Sign in
    </a>
  );
}
