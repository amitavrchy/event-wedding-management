"use client";
import { useRef, useState } from "react";
import {
  Plus,
  Search,
  Upload,
  Download,
  Copy,
  Users,
  Check,
  Armchair,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { Guest } from "@/lib/types";
import { downloadCSV, parseCSV } from "@/lib/csv";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";
export default function Guests() {
  const { event, refresh, notify } = useApp();
  const [adding, setAdding] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [busy, setBusy] = useState(false),
    [seat, setSeat] = useState<Guest | null>(null);
  const input = useRef<HTMLInputElement>(null);
  if (!event)
    return <Empty title="Create a celebration to gather your people" />;
  const guests = event.guests || [],
    accepted = guests
      .filter((g) => g.rsvpStatus === "ACCEPTED")
      .reduce((s, g) => s + g.partySize, 0),
    visible = guests.filter(
      (g) =>
        (filter === "ALL" || g.rsvpStatus === filter) &&
        g.name.toLowerCase().includes(search.toLowerCase()),
    );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      if (seat)
        await api(`events/${event!.id}/guests/${seat.id}`, {
          method: "PATCH",
          body: json({ tableLabel: f.get("tableLabel") }),
        });
      else
        await api(`events/${event!.id}/guests`, {
          method: "POST",
          body: json({
            name: f.get("name"),
            email: f.get("email") || undefined,
            phone: f.get("phone") || undefined,
            maxPartySize: Number(f.get("maxPartySize")),
            groupName: f.get("groupName") || "Friends",
            dietaryNotes: f.get("dietaryNotes") || undefined,
          }),
        });
      await refresh();
      setAdding(false);
      setSeat(null);
      notify(seat ? "Seating saved" : "A lovely addition to your guest list");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
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
        throw new Error("CSV header must be: name,email,phone,maxPartySize");
      const guests = rows.map((r) => ({
        name: r[0]?.trim(),
        email: r[1]?.trim() || undefined,
        phone: r[2]?.trim() || undefined,
        maxPartySize: r[3] ? Number(r[3]) : 2,
      }));
      await api(`events/${event!.id}/guests/import`, {
        method: "POST",
        body: json({ guests }),
      });
      await refresh();
      notify(`${guests.length} guests added`);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="THE PEOPLE WHO MAKE IT EVERYTHING"
        title="Your favorite people"
        description="Gather your people, send a little love, and keep every RSVP in one place."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={18} />
            Add a guest
          </Button>
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
        <div className="button-group">
          <Button
            busy={busy}
            variant="secondary"
            onClick={() => input.current?.click()}
          >
            <Upload size={17} />
            Import CSV
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              downloadCSV(
                "utsab-guests.csv",
                ["name", "email", "phone", "maxPartySize"],
                guests.map((g) => [
                  g.name,
                  g.email || "",
                  g.phone || "",
                  String(g.maxPartySize),
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
        CSV columns: name,email,phone,maxPartySize · Up to 500 guests per import
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
                <th>RSVP</th>
                <th>Party</th>
                <th>Meal</th>
                <th>Seating</th>
                <th>Invitation</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => (
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
                          {g.email || g.phone || "Your special guest"}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge value={g.rsvpStatus} />
                  </td>
                  <td>
                    {g.partySize} / {g.maxPartySize}
                  </td>
                  <td>{g.mealPreference || "—"}</td>
                  <td>
                    <button className="text-link" onClick={() => setSeat(g)}>
                      {g.tableLabel || "Assign table"}
                    </button>
                  </td>
                  <td>
                    <button
                      className="text-link"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `${location.origin}/rsvp/${g.token}`,
                          );
                          notify("Invitation link copied");
                        } catch {
                          notify(
                            "Clipboard unavailable. Open the invitation to copy its address.",
                            true,
                          );
                        }
                      }}
                    >
                      <Copy size={15} />
                      Copy link
                    </button>
                    <a
                      className="text-link invitation-open"
                      target="_blank"
                      rel="noreferrer"
                      href={`/rsvp/${g.token}`}
                    >
                      Open ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <Empty title="There’s always room for your favorite people">
            Add a guest or try another search.
          </Empty>
        )}
      </section>
      {(adding || seat) && (
        <Modal
          title={
            seat ? `A seat for ${seat.name}` : "One more reason to celebrate"
          }
          onClose={() => {
            setAdding(false);
            setSeat(null);
          }}
        >
          <form className="form-stack" onSubmit={submit}>
            {seat ? (
              <Field label="Table or seating area">
                <input
                  name="tableLabel"
                  maxLength={50}
                  defaultValue={seat.tableLabel || ""}
                  placeholder="Table 1 · Family"
                />
              </Field>
            ) : (
              <>
                <Field label="Guest name">
                  <input name="name" minLength={2} maxLength={100} required />
                </Field>
                <Field label="Email (optional)">
                  <input name="email" type="email" />
                </Field>
                <Field label="Phone (optional)">
                  <input name="phone" maxLength={25} />
                </Field>
                <Field label="Maximum party size, including guest">
                  <input
                    type="number"
                    name="maxPartySize"
                    defaultValue="2"
                    min="1"
                    max="10"
                    required
                  />
                </Field>
                <Field label="Guest group">
                  <input
                    name="groupName"
                    defaultValue="Friends"
                    required
                    maxLength={60}
                    placeholder="Family / friends / colleagues"
                  />
                </Field>
                <Field label="Dietary notes">
                  <textarea
                    name="dietaryNotes"
                    maxLength={500}
                    placeholder="Allergies and catering requirements"
                  />
                </Field>
              </>
            )}
            <Button busy={busy}>Save {seat ? "seating" : "guest"}</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
