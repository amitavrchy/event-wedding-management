"use client";
import { use, useState } from "react";
import Link from "next/link";
import { UserPlus, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/context";
import { useAction } from "@/lib/use-resource";
import { Button } from "@/components/ui";
export default function AcceptInvite({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params),
    { refresh, user } = useApp(),
    { busy, run } = useAction();
  const [joined, setJoined] = useState(false);
  return (
    <section className="card invite-card">
      <span className="stat-icon rose">
        {joined ? <Check /> : <UserPlus />}
      </span>
      <h1>
        {joined ? "You’re part of the circle." : "A little planning, together."}
      </h1>
      <p>
        Signed in as {user?.fullName}. This invitation must match your account
        email.
      </p>
      {joined ? (
          <Link className="button primary" href="/dashboard">
          Open your workspace
        </Link>
      ) : (
        <Button
          busy={busy}
          onClick={() =>
            void run(async () => {
              await api(`collaboration/accept/${token}`, { method: "POST" });
              await refresh();
              setJoined(true);
            }, "You’ve joined the workspace")
          }
        >
          Accept invitation
        </Button>
      )}
    </section>
  );
}
