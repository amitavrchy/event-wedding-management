"use client";
import { useState } from "react";
import { Plus, UserPlus, Copy, ShieldCheck, Trash2 } from "lucide-react";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { useAction, useResource } from "@/lib/use-resource";
import { Vendor } from "@/lib/types";
import { dateLabel } from "@/lib/format";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";
type Team = {
  members: {
    id: string;
    permission: string;
    expiresAt: string;
    user?: { fullName: string; email: string };
  }[];
  invites: {
    id: string;
    token: string;
    email: string;
    permission: string;
    expiresAt: string;
  }[];
};
export default function Collaboration() {
  const { event, user, notify } = useApp();
  const vendor = user?.role === "VENDOR";
  const [business, setBusiness] = useState(""),
    [adding, setAdding] = useState(false);
  const { data: businesses } = useResource<Vendor[]>(
    vendor ? "vendors/mine" : null,
    [],
  );
  const id = vendor ? business || businesses[0]?.id : event?.id,
    scope = vendor ? "VENDOR" : "EVENT";
  const { data, reload } = useResource<Team>(
    id ? `collaboration/${scope}/${id}` : null,
    { members: [], invites: [] },
  );
  const { busy, run } = useAction();
  if (!id)
    return (
      <Empty
        title={
          vendor
            ? "Add your business to build your team"
            : "Create a celebration to invite your people"
        }
      />
    );
  return (
    <>
      <PageHeading
        eyebrow="BETTER DAYS ARE BUILT TOGETHER"
        title={vendor ? "Your professional team" : "Your planning circle"}
        description="Invite people by email, give them the right permissions, and keep access limited to the time they need."
        action={
          <Button onClick={() => setAdding(true)}>
            <UserPlus size={17} />
            Invite a teammate
          </Button>
        }
      />
      {vendor && (
        <div className="workspace-filter">
          <Field label="Your business">
            <select value={id} onChange={(e) => setBusiness(e.target.value)}>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.businessName}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <div className="document-intro">
        <ShieldCheck size={29} />
        <div>
          <h2>A little trust, with thoughtful boundaries.</h2>
          <p>
            Viewers can read.{" "}
            {vendor
              ? "Managers can operate your business."
              : "Editors can plan with you."}{" "}
            Only the owner can invite or remove people. Invitations expire after
            seven days; workspace access has its own deadline.
          </p>
        </div>
      </div>
      <section className="card">
        <div className="card-heading">
          <h2>Your collaborators</h2>
        </div>
        {data.members.map((m) => (
          <div className="team-row" key={m.id}>
            <span className="person-avatar">{m.user?.fullName[0] || "✧"}</span>
            <div>
              <h3>{m.user?.fullName || "Teammate"}</h3>
              <p>{m.user?.email}</p>
              <small>Access until {dateLabel(m.expiresAt)}</small>
            </div>
            <Badge value={m.permission} />
            <Button
              variant="ghost"
              busy={busy}
              onClick={() =>
                void run(async () => {
                  await api(`collaboration/${scope}/${id}/members/${m.id}`, {
                    method: "DELETE",
                  });
                  await reload();
                }, "Access revoked")
              }
            >
              Remove access
            </Button>
          </div>
        ))}
        {!data.members.length && (
          <Empty title="Your planning circle starts with you">
            Invite someone who makes the little details feel lighter.
          </Empty>
        )}
      </section>
      <section className="card section-gap">
        <div className="card-heading">
          <h2>Invitations on their way</h2>
        </div>
        {data.invites.map((i) => (
          <div className="team-row" key={i.id}>
            <div>
              <h3>{i.email}</h3>
              <p>
                {i.permission.toLowerCase()} · link expires{" "}
                {dateLabel(i.expiresAt)}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${location.origin}/invite/${i.token}`,
                  );
                  notify(
                    "Invitation link copied. Share it with the invited email owner.",
                  );
                } catch {
                  notify(
                    "Clipboard unavailable. Open the invite link and copy its address.",
                    true,
                  );
                }
              }}
            >
              <Copy size={16} />
              Copy invite
            </Button>
            <a
              className="text-link"
              href={`/invite/${i.token}`}
              target="_blank"
              rel="noreferrer"
            >
              Open ↗
            </a>
            <button
              className="icon-button"
              aria-label={`Cancel invite to ${i.email}`}
              onClick={() =>
                void run(async () => {
                  await api(`collaboration/${scope}/${id}/invites/${i.id}`, {
                    method: "DELETE",
                  });
                  await reload();
                })
              }
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        {!data.invites.length && <Empty title="No pending invitations" />}
      </section>
      {adding && (
        <Modal
          title="Invite a little extra support"
          onClose={() => setAdding(false)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await run(async () => {
                  await api(`collaboration/${scope}/${id}/invites`, {
                    method: "POST",
                    body: json({
                      email: f.get("email"),
                      permission: f.get("permission"),
                      days: Number(f.get("days")),
                    }),
                  });
                  await reload();
                }, "Invitation created. Copy its link to share with your teammate.")
              )
                setAdding(false);
            }}
          >
            <Field label="Teammate’s account email">
              <input name="email" type="email" required />
            </Field>
            <Field label="Workspace permission">
              <select name="permission">
                <option value={vendor ? "MANAGER" : "EDITOR"}>
                  {vendor
                    ? "Manager · business operations"
                    : "Editor · can help plan"}
                </option>
                <option value="VIEWER">Viewer · can read only</option>
              </select>
            </Field>
            <Field label="Access duration in days">
              <input
                name="days"
                type="number"
                min="1"
                max="180"
                defaultValue="90"
                required
              />
            </Field>
            <p className="helper-text">
              Event access also ends one day after the last celebration. Share
              the invitation with its exact email owner; vendor teammates need
              vendor accounts.
            </p>
            <Button busy={busy}>Create invitation</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
