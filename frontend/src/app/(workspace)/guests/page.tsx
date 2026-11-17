"use client";
import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Upload,
  Download,
  Copy,
  Users,
  Check,
  Armchair,
  Pencil,
  Trash2,
  MessageCircle,
  Home,
  Heart,
} from "lucide-react";
import "@/app/tools.css";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { Guest, Household, SideSummary } from "@/lib/types";
import { downloadCSV, parseCSV } from "@/lib/csv";
import { whatsappLink } from "@/lib/whatsapp";
import {
  Badge,
  Button,
  CardHeading,
  Empty,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";

const SIDE_LABEL = {
  BRIDE: "Bride's side",
  GROOM: "Groom's side",
  BOTH: "Both",
} as const;

function GuestsPage() {
  const { event, refresh, notify } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const features = event?.features || [];
  const hasSides = features.includes("sides");
  const hasHouseholds = features.includes("households");
  const view =
    params.get("view") === "sides" && hasSides
      ? "sides"
      : params.get("view") === "households" && hasHouseholds
        ? "households"
        : "list";
  const [editing, setEditing] = useState<Guest | "new" | null>(null),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [side, setSide] = useState(""),
    [busy, setBusy] = useState(false),
    [familyForm, setFamilyForm] = useState(false),
    [quotaForm, setQuotaForm] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const households = useResource<Household[]>(
    event && hasHouseholds ? `events/${event.id}/households` : null,
    [],
  );
  const sides = useResource<SideSummary[]>(
    event && hasSides ? `events/${event.id}/guests/sides/summary` : null,
    [],
  );
  if (!event)
    return <Empty title="Create a celebration to gather your people" />;
  const readOnly = event.access === "VIEWER";
  const sideLabel = (s?: string | null) =>
    s
      ? event.sides?.[s]?.label || SIDE_LABEL[s as keyof typeof SIDE_LABEL]
      : "—";
  const guests = event.guests || [],
    accepted = guests
      .filter((g) => g.rsvpStatus === "ACCEPTED")
      .reduce((s, g) => s + g.partySize, 0),
    visible = guests.filter(
      (g) =>
        (filter === "ALL" || g.rsvpStatus === filter) &&
        (!side || g.side === side) &&
        g.name.toLowerCase().includes(search.toLowerCase()),
    );
  const reloadAll = () =>
    Promise.all([refresh(), households.reload(), sides.reload()]);
  const setView = (v: string) =>
    router.replace(v === "list" ? "/guests" : `/guests?view=${v}`);
  const inviteText = (name: string, url: string) =>
    `আসসালামু আলাইকুম ${name},\n${event.title} — আপনার উপস্থিতি জানাতে এই লিংকে ক্লিক করুন: ${url}`;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const body = {
      name: f.get("name"),
      email: f.get("email") || undefined,
      phone: f.get("phone") || undefined,
      maxPartySize: Number(f.get("maxPartySize")),
      groupName: f.get("groupName") || "Friends",
      dietaryNotes: f.get("dietaryNotes") || undefined,
      ...(hasSides ? { side: f.get("side") || null } : {}),
      ...(hasHouseholds ? { householdId: f.get("householdId") || null } : {}),
      relationship: f.get("relationship") || undefined,
      ...(editing !== "new"
        ? { tableLabel: f.get("tableLabel") || undefined }
        : {}),
    };
    try {
      if (editing === "new")
        await api(`events/${event!.id}/guests`, {
          method: "POST",
          body: json(body),
        });
      else
        await api(`events/${event!.id}/guests/${(editing as Guest).id}`, {
          method: "PATCH",
          body: json(body),
        });
      await reloadAll();
      setEditing(null);
      notify(
        editing === "new"
          ? "A lovely addition to your guest list"
          : "Guest updated",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function remove(g: Guest) {
    if (!window.confirm(`Remove ${g.name} from the guest list?`)) return;
    try {
      await api(`events/${event!.id}/guests/${g.id}`, { method: "DELETE" });
      await reloadAll();
      notify(`${g.name} removed`);
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 1000000) throw new Error("CSV must be under 1 MB");
      const rows = parseCSV(await file.text());
      const header = rows.shift()?.map((v) => v.trim().toLowerCase());
      if (header?.[0] !== "name")
        throw new Error(
          "CSV header must start with: name,email,phone,maxPartySize,side",
        );
      const sideIndex = header.indexOf("side");
      const list = rows.map((r) => {
        const value = sideIndex >= 0 ? r[sideIndex]?.trim().toUpperCase() : "";
        return {
          name: r[0]?.trim(),
          email: r[1]?.trim() || undefined,
          phone: r[2]?.trim() || undefined,
          maxPartySize: r[3] ? Number(r[3]) : 2,
          ...(hasSides && ["BRIDE", "GROOM", "BOTH"].includes(value)
            ? { side: value }
            : {}),
        };
      });
      await api(`events/${event!.id}/guests/import`, {
        method: "POST",
        body: json({ guests: list }),
      });
      await reloadAll();
      notify(`${list.length} guests added`);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function markSent(guestIds: string[], householdIds: string[] = []) {
    try {
      await api(`events/${event!.id}/guests/mark-sent`, {
        method: "POST",
        body: json({ guestIds, householdIds }),
      });
      await reloadAll();
    } catch {}
  }

  return (
    <>
      <PageHeading
        eyebrow="THE PEOPLE WHO MAKE IT EVERYTHING"
        title="Your favorite people"
        description="Invitations, replies and who is coming, all in one list."
        action={
          !readOnly && (
            <div className="button-group">
              {hasHouseholds && (
                <Button variant="secondary" onClick={() => setFamilyForm(true)}>
                  <Home size={18} />
                  Add a family
                </Button>
              )}
              <Button onClick={() => setEditing("new")}>
                <Plus size={18} />
                Add a guest
              </Button>
            </div>
          )
        }
      />
      <div className="mini-stats">
        <article>
          <Users size={22} />
          <strong>{guests.length}</strong>
          <span>Invitations</span>
        </article>
        <article>
          <Check size={22} />
          <strong>{accepted}</strong>
          <span>Guests attending</span>
        </article>
        <article>
          <Armchair size={22} />
          <strong>{event.guestCapacity - accepted}</strong>
          <span>Seats remaining</span>
        </article>
      </div>
      {accepted > event.guestCapacity && (
        <div className="error-banner">
          Your confirmed guest count exceeds venue capacity. Review seating
          before sending more invitations.
        </div>
      )}
      {(hasSides || hasHouseholds) && (
        <div className="tabs" role="tablist" aria-label="Guest views">
          <button
            className={view === "list" ? "selected" : ""}
            onClick={() => setView("list")}
          >
            All guests
          </button>
          {hasSides && (
            <button
              className={view === "sides" ? "selected" : ""}
              onClick={() => setView("sides")}
            >
              <Heart size={15} /> Bride & groom sides
            </button>
          )}
          {hasHouseholds && (
            <button
              className={view === "households" ? "selected" : ""}
              onClick={() => setView("households")}
            >
              <Home size={15} /> Families
            </button>
          )}
        </div>
      )}

      {view === "sides" && (
        <section className="card">
          <CardHeading
            title="Each family's list"
            subtitle="Invitations and replies against each side's quota."
          />
          <div className="side-grid padded">
            {sides.data.map((s) => (
              <article key={s.side || "none"} className="side-card">
                <h3>{s.label}</h3>
                <p>
                  <strong>{s.acceptedPeople}</strong> attending ·{" "}
                  {s.invitations} invitations ({s.invitedPeople} people)
                </p>
                {s.quota != null && (
                  <>
                    <div
                      className={`progress ${s.invitedPeople > s.quota ? "rose" : ""}`}
                    >
                      <span
                        style={{
                          width: `${Math.min(100, (s.invitedPeople / Math.max(1, s.quota)) * 100)}%`,
                        }}
                      />
                    </div>
                    <small>
                      {s.invitedPeople} of {s.quota} invited
                      {s.invitedPeople > s.quota ? " — over quota" : ""}
                    </small>
                  </>
                )}
                {s.side && (
                  <button
                    className="text-link"
                    onClick={() => setSide(s.side || "")}
                  >
                    Show this list
                  </button>
                )}
              </article>
            ))}
          </div>
          {!readOnly && (
            <div className="padded">
              <Button variant="secondary" onClick={() => setQuotaForm(true)}>
                Names, quotas and cost share
              </Button>
            </div>
          )}
        </section>
      )}

      {view === "households" && (
        <section className="card table-card">
          <CardHeading
            title="Family invitations"
            subtitle="One link per family. Each member replies on the same page."
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Family</th>
                  {hasSides && <th>Side</th>}
                  <th>Members</th>
                  <th>Invitation</th>
                </tr>
              </thead>
              <tbody>
                {households.data.map((h) => {
                  const url = h.token
                    ? `${location.origin}/rsvp/family/${h.token}`
                    : "";
                  return (
                    <tr key={h.id}>
                      <td>
                        <strong>{h.name}</strong>
                        <small className="block muted">{h.phone || ""}</small>
                      </td>
                      {hasSides && <td>{sideLabel(h.side)}</td>}
                      <td>
                        {h.members.map((m) => (
                          <span key={m.id} className="chip">
                            {m.name} <Badge value={m.rsvpStatus} />
                          </span>
                        ))}
                      </td>
                      <td>
                        {url && (
                          <a
                            className="text-link"
                            target="_blank"
                            rel="noreferrer"
                            href={whatsappLink(
                              inviteText(h.name, url),
                              h.phone,
                            )}
                            onClick={() => void markSent([], [h.id])}
                          >
                            <MessageCircle size={15} /> WhatsApp
                          </a>
                        )}
                        <small className="block muted">
                          {h.invitationOpenedAt
                            ? "Opened"
                            : h.invitationSentAt
                              ? "Sent"
                              : "Not sent"}
                        </small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!households.data.length && (
            <Empty title="No families yet">
              Add a family to send one invitation for everyone.
            </Empty>
          )}
        </section>
      )}

      {view === "list" || view === "sides" ? (
        <>
          <div className="filter-bar">
            <div className="search-field">
              <Search size={18} />
              <input
                aria-label="Search guests"
                placeholder="Find someone on your list…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {hasSides && (
              <select
                aria-label="Filter by side"
                value={side}
                onChange={(e) => setSide(e.target.value)}
              >
                <option value="">Both sides</option>
                <option value="BRIDE">{sideLabel("BRIDE")}</option>
                <option value="GROOM">{sideLabel("GROOM")}</option>
                <option value="BOTH">{sideLabel("BOTH")}</option>
              </select>
            )}
            <div className="button-group">
              {!readOnly && (
                <Button
                  busy={busy}
                  variant="secondary"
                  onClick={() => input.current?.click()}
                >
                  <Upload size={17} />
                  Import CSV
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() =>
                  downloadCSV(
                    "guests.csv",
                    ["name", "email", "phone", "maxPartySize", "side", "rsvp"],
                    guests.map((g) => [
                      g.name,
                      g.email || "",
                      g.phone || "",
                      String(g.maxPartySize),
                      g.side || "",
                      g.rsvpStatus,
                    ]),
                  )
                }
              >
                <Download size={17} />
                Export
              </Button>
            </div>
            <input
              ref={input}
              type="file"
              accept=".csv"
              hidden
              onChange={(e) => void importFile(e.target.files?.[0])}
            />
          </div>
          <p className="helper-text">
            CSV columns: name,email,phone,maxPartySize
            {hasSides ? ",side (BRIDE/GROOM/BOTH)" : ""} · Up to 500 guests per
            import
          </p>
          <div className="tabs">
            {[
              ["ALL", "Everyone"],
              ["ACCEPTED", "Attending"],
              ["INVITED", "Awaiting reply"],
              ["DECLINED", "Unable to attend"],
              ["MAYBE", "Maybe"],
            ].map(([v, l]) => (
              <button
                key={v}
                className={filter === v ? "selected" : ""}
                onClick={() => setFilter(v)}
              >
                {l}
              </button>
            ))}
          </div>
          <section className="card table-card">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Guest</th>
                    {hasSides && <th>Side</th>}
                    <th>RSVP</th>
                    <th>Party</th>
                    <th>Meal</th>
                    <th>Invitation</th>
                    {!readOnly && <th aria-label="Actions" />}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((g) => {
                    const url = g.token
                      ? `${location.origin}/rsvp/${g.token}`
                      : "";
                    return (
                      <tr key={g.id}>
                        <td>
                          <div className="table-person">
                            <span className="person-avatar">
                              {g.name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <div>
                              <strong>{g.name}</strong>
                              <small>
                                {g.relationship ||
                                  g.email ||
                                  g.phone ||
                                  g.groupName}
                              </small>
                            </div>
                          </div>
                        </td>
                        {hasSides && <td>{sideLabel(g.side)}</td>}
                        <td>
                          <Badge value={g.rsvpStatus} />
                        </td>
                        <td>
                          {g.partySize} / {g.maxPartySize}
                        </td>
                        <td>{g.mealPreference || "—"}</td>
                        <td>
                          {url && (
                            <>
                              <a
                                className="text-link"
                                target="_blank"
                                rel="noreferrer"
                                href={whatsappLink(
                                  inviteText(g.name, url),
                                  g.phone,
                                )}
                                onClick={() => void markSent([g.id])}
                              >
                                <MessageCircle size={15} /> WhatsApp
                              </a>
                              <a
                                className="text-link invitation-open"
                                target="_blank"
                                rel="noreferrer"
                                href={`/rsvp/${g.token}`}
                              >
                                Open ↗
                              </a>
                              <button
                                className="text-link"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(url);
                                    notify("Invitation link copied");
                                  } catch {
                                    notify(
                                      "Clipboard unavailable. Open the invitation to copy its address.",
                                      true,
                                    );
                                  }
                                }}
                              >
                                <Copy size={15} /> Copy
                              </button>
                            </>
                          )}
                          <small className="block muted">
                            {g.invitationOpenedAt
                              ? "Opened"
                              : g.invitationSentAt
                                ? "Sent"
                                : ""}
                          </small>
                        </td>
                        {!readOnly && (
                          <td className="row-actions">
                            <button
                              className="icon-button"
                              aria-label={`Edit ${g.name}`}
                              onClick={() => setEditing(g)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Remove ${g.name}`}
                              onClick={() => void remove(g)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!visible.length && (
              <Empty title="There’s always room for your favorite people">
                Add a guest or try another search.
              </Empty>
            )}
          </section>
        </>
      ) : null}

      {editing && (
        <Modal
          title={
            editing === "new"
              ? "One more reason to celebrate"
              : `Edit ${editing.name}`
          }
          onClose={() => setEditing(null)}
        >
          <form className="form-stack" onSubmit={save}>
            {(() => {
              const g = editing === "new" ? null : editing;
              return (
                <>
                  <Field label="Guest name">
                    <input
                      name="name"
                      minLength={2}
                      maxLength={100}
                      required
                      defaultValue={g?.name}
                    />
                  </Field>
                  <div className="form-row">
                    <Field label="Phone (for WhatsApp)">
                      <input
                        name="phone"
                        maxLength={25}
                        defaultValue={g?.phone}
                        placeholder="01XXXXXXXXX"
                      />
                    </Field>
                    <Field label="Email (optional)">
                      <input
                        name="email"
                        type="email"
                        defaultValue={g?.email}
                      />
                    </Field>
                  </div>
                  <div className="form-row">
                    <Field label="Maximum party size">
                      <input
                        type="number"
                        name="maxPartySize"
                        defaultValue={g?.maxPartySize ?? 2}
                        min="1"
                        max="20"
                        required
                      />
                    </Field>
                    <Field label="Relationship">
                      <input
                        name="relationship"
                        maxLength={60}
                        defaultValue={g?.relationship || ""}
                        placeholder="Mama, colleague, friend…"
                      />
                    </Field>
                  </div>
                  {hasSides && (
                    <Field label="Side">
                      <select name="side" defaultValue={g?.side || ""}>
                        <option value="">Not assigned</option>
                        <option value="BRIDE">{sideLabel("BRIDE")}</option>
                        <option value="GROOM">{sideLabel("GROOM")}</option>
                        <option value="BOTH">{sideLabel("BOTH")}</option>
                      </select>
                    </Field>
                  )}
                  {hasHouseholds && (
                    <Field label="Family">
                      <select
                        name="householdId"
                        defaultValue={g?.householdId || ""}
                      >
                        <option value="">Individual invitation</option>
                        {households.data.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <Field label="Guest group">
                    <input
                      name="groupName"
                      defaultValue={g?.groupName || "Friends"}
                      required
                      maxLength={60}
                    />
                  </Field>
                  {g && (
                    <Field label="Table or seating area">
                      <input
                        name="tableLabel"
                        maxLength={50}
                        defaultValue={g.tableLabel || ""}
                      />
                    </Field>
                  )}
                  <Field label="Dietary notes">
                    <textarea
                      name="dietaryNotes"
                      maxLength={500}
                      defaultValue={g?.dietaryNotes}
                      placeholder="Allergies and catering requirements"
                    />
                  </Field>
                </>
              );
            })()}
            <Button busy={busy}>Save guest</Button>
          </form>
        </Modal>
      )}

      {familyForm && (
        <Modal
          title="Invite a whole family"
          onClose={() => setFamilyForm(false)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const members = String(f.get("members") || "")
                .split("\n")
                .map((n) => n.trim())
                .filter((n) => n.length >= 2)
                .map((name) => ({ name }));
              setBusy(true);
              try {
                await api(`events/${event.id}/households`, {
                  method: "POST",
                  body: json({
                    name: f.get("name"),
                    side: f.get("side") || null,
                    phone: f.get("phone") || undefined,
                    members,
                  }),
                });
                await reloadAll();
                setFamilyForm(false);
                notify("Family added. Share one link with everyone.");
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Family name">
              <input
                name="name"
                required
                minLength={2}
                placeholder="Rahman poribar"
              />
            </Field>
            <Field label="Phone (for WhatsApp)">
              <input name="phone" maxLength={25} placeholder="01XXXXXXXXX" />
            </Field>
            {hasSides && (
              <Field label="Side">
                <select name="side" defaultValue="">
                  <option value="">Not assigned</option>
                  <option value="BRIDE">{sideLabel("BRIDE")}</option>
                  <option value="GROOM">{sideLabel("GROOM")}</option>
                  <option value="BOTH">{sideLabel("BOTH")}</option>
                </select>
              </Field>
            )}
            <Field label="Members (one name per line)">
              <textarea
                name="members"
                rows={5}
                placeholder={"Abdur Rahman\nSalma Rahman\nNabil Rahman"}
              />
            </Field>
            <Button busy={busy}>Add family</Button>
          </form>
        </Modal>
      )}

      {quotaForm && (
        <Modal title="Family sides" onClose={() => setQuotaForm(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const entry = (key: string) => ({
                label: String(f.get(`${key}-label`) || "") || undefined,
                quota: f.get(`${key}-quota`)
                  ? Number(f.get(`${key}-quota`))
                  : null,
                share: Number(f.get(`${key}-share`) || 50),
              });
              setBusy(true);
              try {
                await api(`events/${event.id}/sides`, {
                  method: "PUT",
                  body: json({ BRIDE: entry("BRIDE"), GROOM: entry("GROOM") }),
                });
                await reloadAll();
                setQuotaForm(false);
                notify("Sides saved");
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            {(["BRIDE", "GROOM"] as const).map((key) => (
              <fieldset key={key} className="form-row">
                <Field label="Name">
                  <input
                    name={`${key}-label`}
                    defaultValue={
                      event.sides?.[key]?.label ||
                      (key === "BRIDE" ? "কনে পক্ষ" : "বর পক্ষ")
                    }
                    maxLength={40}
                  />
                </Field>
                <Field label="Guest quota">
                  <input
                    name={`${key}-quota`}
                    type="number"
                    min="0"
                    defaultValue={event.sides?.[key]?.quota ?? ""}
                  />
                </Field>
                <Field label="Cost share %">
                  <input
                    name={`${key}-share`}
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={event.sides?.[key]?.share ?? 50}
                  />
                </Field>
              </fieldset>
            ))}
            <Button busy={busy}>Save</Button>
          </form>
        </Modal>
      )}
    </>
  );
}

export default function Guests() {
  return (
    <Suspense>
      <GuestsPage />
    </Suspense>
  );
}
