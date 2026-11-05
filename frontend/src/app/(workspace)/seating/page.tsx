"use client";
import { useRef, useState } from "react";
import { Plus, Printer, Armchair, Move, Trash2, Search } from "lucide-react";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { useAction, useResource } from "@/lib/use-resource";
import { SeatTable, Seating } from "@/lib/advanced";
import { Button, Empty, Field, Modal, PageHeading } from "@/components/ui";
export default function SeatingPage() {
  const { event } = useApp();
  const { data, reload, setData } = useResource<Seating>(
    event ? `events/${event.id}/seating` : null,
    { tables: [], guests: [], capacity: 0 },
  );
  const { busy, run } = useAction();
  const [adding, setAdding] = useState(false),
    [selected, setSelected] = useState(""),
    [search, setSearch] = useState("");
  const floor = useRef<HTMLDivElement>(null),
    drag = useRef<{
      table: SeatTable;
      startX: number;
      startY: number;
      x: number;
      y: number;
    } | null>(null);
  if (!event)
    return <Empty title="Create a celebration to design your floor plan" />;
  const table = data.tables.find((t) => t.id === selected),
    assigned = data.guests
      .filter((g) => g.seatingTableId && g.rsvpStatus !== "DECLINED")
      .reduce((s, g) => s + g.partySize, 0);
  async function place(guestId: string, tableId: string | null) {
    await run(async () => {
      await api(`events/${event!.id}/seating/assign`, {
        method: "POST",
        body: json({ guestId, tableId }),
      });
      await reload();
    }, "Seating saved");
  }
  return (
    <>
      <PageHeading
        eyebrow="A PLACE FOR EVERY FAVORITE PERSON"
        title="The seating studio"
        description="Design the room, gather your groups, and give everyone a place to belong."
        action={
          <div className="button-group">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={17} />
              Print floor plan
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus size={18} />
              Add a table
            </Button>
          </div>
        }
      />
      <div className="advanced-metrics">
        <div>
          <Armchair />
          <strong>{assigned}</strong>
          <span>Seats assigned</span>
        </div>
        <div>
          <strong>{data.tables.reduce((s, t) => s + t.capacity, 0)}</strong>
          <span>Table capacity</span>
        </div>
        <div>
          <strong>{data.capacity}</strong>
          <span>Venue capacity</span>
        </div>
        <div>
          <strong>
            {
              data.guests.filter(
                (g) => !g.seatingTableId && g.rsvpStatus !== "DECLINED",
              ).length
            }
          </strong>
          <span>Parties to place</span>
        </div>
      </div>
      <div className="seating-layout">
        <section className="card floor-card">
          <div className="floor-toolbar">
            <span>
              <Move size={17} />
              Drag tables to arrange the room
            </span>
            <span>12 × 8 planning grid</span>
          </div>
          <div className="floor-viewport">
            <div
              className="floor-plan"
              ref={floor}
              role="region"
              aria-label="Interactive seating floor plan"
            >
              <div className="floor-stage">THE CELEBRATION STAGE</div>
              {data.tables.map((t) => {
                const used = data.guests
                  .filter(
                    (g) =>
                      g.seatingTableId === t.id && g.rsvpStatus !== "DECLINED",
                  )
                  .reduce((s, g) => s + g.partySize, 0);
                return (
                  <button
                    key={t.id}
                    aria-label={`${t.label}, ${used} of ${t.capacity} seats`}
                    className={`floor-table ${t.shape.toLowerCase()} ${selected === t.id ? "selected" : ""} ${used > t.capacity ? "over-capacity" : ""}`}
                    style={{ left: t.x, top: t.y }}
                    onClick={() => setSelected(t.id)}
                    onKeyDown={async (e) => {
                      const offsets: Record<string, number[]> = {
                        ArrowRight: [10, 0],
                        ArrowLeft: [-10, 0],
                        ArrowUp: [0, -10],
                        ArrowDown: [0, 10],
                      };
                      if (!offsets[e.key]) return;
                      e.preventDefault();
                      const [dx, dy] = offsets[e.key];
                      await run(async () => {
                        await api(`events/${event.id}/seating/tables/${t.id}`, {
                          method: "PATCH",
                          body: json({
                            x: Math.min(1100, Math.max(0, t.x + dx)),
                            y: Math.min(700, Math.max(0, t.y + dy)),
                            version: t.version,
                          }),
                        });
                        await reload();
                      });
                    }}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      drag.current = {
                        table: t,
                        startX: e.clientX,
                        startY: e.clientY,
                        x: t.x,
                        y: t.y,
                      };
                      setSelected(t.id);
                    }}
                    onPointerMove={(e) => {
                      if (!drag.current || drag.current.table.id !== t.id)
                        return;
                      const x = Math.max(
                          0,
                          Math.min(
                            1100,
                            drag.current.x + e.clientX - drag.current.startX,
                          ),
                        ),
                        y = Math.max(
                          0,
                          Math.min(
                            700,
                            drag.current.y + e.clientY - drag.current.startY,
                          ),
                        );
                      setData((current) => ({
                        ...current,
                        tables: current.tables.map((item) =>
                          item.id === t.id ? { ...item, x, y } : item,
                        ),
                      }));
                    }}
                    onPointerUp={async (e) => {
                      if (!drag.current || drag.current.table.id !== t.id)
                        return;
                      const original = drag.current;
                      drag.current = null;
                      e.currentTarget.releasePointerCapture(e.pointerId);
                      if (t.x === original.table.x && t.y === original.table.y)
                        return;
                      await run(async () => {
                        await api(`events/${event.id}/seating/tables/${t.id}`, {
                          method: "PATCH",
                          body: json({
                            x: t.x,
                            y: t.y,
                            version: original.table.version,
                          }),
                        });
                      });
                      await reload();
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                      void reload();
                    }}
                  >
                    <strong>{t.label}</strong>
                    <span>
                      {used} / {t.capacity}
                    </span>
                  </button>
                );
              })}
              {!data.tables.length && (
                <div className="floor-empty">
                  <Armchair size={40} />
                  <h2>Your room is a blank canvas.</h2>
                  <p>Add a table to start your floor plan.</p>
                </div>
              )}
            </div>
          </div>
          <div className="floor-legend">
            <span>
              <i />
              Available seats
            </span>
            <span>
              <i className="rose-dot" />
              Selected table
            </span>
            <span>Keyboard: select a table, then use arrow keys.</span>
          </div>
        </section>
        <aside className="card seating-sidebar">
          <div className="card-heading">
            <div>
              <h2>{table ? table.label : "Your guest groups"}</h2>
              <p>
                {table
                  ? `${table.capacity} seats · choose guests below`
                  : "Select a table to start assigning guests"}
              </p>
            </div>
            {table && (
              <button
                className="icon-button"
                aria-label="Remove selected table"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api(`events/${event.id}/seating/tables/${table.id}`, {
                      method: "DELETE",
                    });
                    setSelected("");
                    await reload();
                  }, "Table removed; guests are unassigned")
                }
              >
                <Trash2 size={17} />
              </button>
            )}
          </div>
          <div className="search-field seating-search">
            <Search size={17} />
            <input
              aria-label="Search seating guests"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a guest or group"
            />
          </div>
          <div className="seating-guests">
            {data.guests
              .filter(
                (g) =>
                  g.rsvpStatus !== "DECLINED" &&
                  `${g.name} ${g.groupName}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((g) => (
                <div className="seat-guest" key={g.id}>
                  <div>
                    <strong>{g.name}</strong>
                    <small>
                      {g.groupName} · party of {g.partySize}
                    </small>
                    <span>{g.tableLabel || "Not seated yet"}</span>
                  </div>
                  {g.seatingTableId === selected ? (
                    <Button
                      variant="ghost"
                      busy={busy}
                      onClick={() => void place(g.id, null)}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      busy={busy}
                      disabled={!table}
                      onClick={() => void place(g.id, selected)}
                    >
                      Seat here
                    </Button>
                  )}
                </div>
              ))}
          </div>
        </aside>
      </div>
      {adding && (
        <Modal
          title="A place to come together"
          onClose={() => setAdding(false)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await run(async () => {
                  const result = await api<SeatTable>(
                    `events/${event.id}/seating/tables`,
                    {
                      method: "POST",
                      body: json({
                        label: f.get("label"),
                        capacity: Number(f.get("capacity")),
                        shape: f.get("shape"),
                        x: 100 + (data.tables.length % 6) * 140,
                        y: 160 + Math.floor(data.tables.length / 6) * 130,
                      }),
                    },
                  );
                  setSelected(result.id);
                  await reload();
                }, "Your table is ready")
              )
                setAdding(false);
            }}
          >
            <Field label="Table name">
              <input
                name="label"
                placeholder="Table 1 · Family"
                required
                maxLength={60}
              />
            </Field>
            <div className="form-row">
              <Field label="Number of seats">
                <input
                  name="capacity"
                  type="number"
                  min="1"
                  max="50"
                  defaultValue="8"
                  required
                />
              </Field>
              <Field label="Table shape">
                <select name="shape">
                  <option value="ROUND">Round</option>
                  <option value="RECTANGLE">Rectangle</option>
                </select>
              </Field>
            </div>
            <Button busy={busy}>Add to floor plan</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
