"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLang } from "@/components/LangProvider";
import Link from "@/components/LocaleLink";
import { signIn, signOut, useSession } from "@/lib/auth-client";
import { localeHref } from "@/lib/lang";

import { BACKSTAGE_HREF } from "./backstage";

/**
 * The sign-in card on the front page. It reads the session in the browser, as UserMenu does,
 * so the page itself stays free of a database read. Signed in, it offers the way through.
 */
export default function LoginPanel() {
  const router = useRouter();
  const lang = useLang();
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "Something went wrong. Try again.");
      setPending(false);
      return;
    }
    router.push(localeHref(lang, BACKSTAGE_HREF));
    router.refresh();
  }

  if (session) {
    return (
      <div className="bn-card bn-login">
        <h3 className="bn-display">Welcome back</h3>
        <p>Signed in as {session.user.email}</p>
        <Link className="bn-btn bn-btn-primary bn-btn-lg" href={BACKSTAGE_HREF}>
          Open Backstage
        </Link>
        <p className="bn-login-foot">
          Not you?{" "}
          <button
            type="button"
            className="bn-textbtn"
            onClick={() => {
              signOut().then(() => router.refresh());
            }}
          >
            Sign out
          </button>
        </p>
      </div>
    );
  }

  return (
    <form className="bn-card bn-login" onSubmit={onSubmit} aria-busy={isPending}>
      <h3 className="bn-display">Sign in</h3>
      <p>Use your Spoken account.</p>
      <label className="bn-field">
        <span>Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="bn-field">
        <span>Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="bn-error">
          {error}
        </p>
      )}
      <button type="submit" className="bn-btn bn-btn-primary bn-btn-lg" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </button>
      <p className="bn-login-foot">
        No account yet? <Link href="/register">Register</Link>
      </p>
    </form>
  );
}
