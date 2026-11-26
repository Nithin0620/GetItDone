"use client";

import { LogOut } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";

function avatar(name?: string | null, image?: string | null) {
  return (
    <span
      className={`auth-avatar ${image ? "" : "auth-avatar-text"}`}
      style={image ? { backgroundImage: `url(${image})`, backgroundSize: "cover" } : undefined}
    >
      {image ? null : (name ?? "U").slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AuthButton({ enabled }: { enabled: boolean }) {
  const { data: session, status } = useSession();

  if (!enabled) {
    return <span className="chip" title="Add Google and MongoDB credentials to enable accounts">Local demo</span>;
  }
  if (status === "loading") return <span className="chip">…</span>;
  if (session?.user) {
    return (
      <button
        className="btn btn-sm"
        onClick={() => void signOut()}
        title={`Signed in as ${session.user.email ?? session.user.name ?? "you"}`}
      >
        {avatar(session.user.name, session.user.image)}
        <span className="hide-small">{session.user.name?.split(" ")[0] ?? "Account"}</span>
        <LogOut />
      </button>
    );
  }
  return (
    <button className="btn btn-sm" onClick={() => void signIn("google")}>
      Sign in
    </button>
  );
}
