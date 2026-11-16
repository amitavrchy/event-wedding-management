"use client";
import { useState } from "react";
import { BedDouble, Bus, Plus, Trash2 } from "lucide-react";
import "@/app/tools.css";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import {
  Button,
  CardHeading,
  Empty,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";

type Stay = {
  id: string;
  name: string;
  address?: string;
  capacity: number;
  rooms: number;
  contact?: string;
  assignedPeople: number;
};
type Vehicle = {
  id: string;
  label: string;
  capacity: number;
  driverName?: string;
  driverPhone?: string;
  route?: string;
  assignedPeople: number;
};
type Traveler = {
  guestId: string;
  accommodationId?: string | null;
  transportId?: string | null;
  fromCity?: string | null;
  arrivalAt?: string | null;
  guest?: { name: string; partySize: number; phone?: string };
};
type Overview = {
  accommodations: Stay[];
  transports: Vehicle[];
  travelers: Traveler[];
};

export default function Logistics() {
  const { event, notify } = useApp();
  const data = useResource<Overview | null>(
    event ? `events/${event.id}/logistics` : null,
    null,
  );
  const [form, setForm] = useState<"stay" | "vehicle" | null>(null),
    [busy, setBusy] = useState(false);
  if (!event) return <Empty title="Create a celebration first" />;
  const readOnly = event.access === "VIEWER";
  const accepted = (event.guests || []).filter(
    (g) => g.rsvpStatus !== "DECLINED",
  );
  async function assign(guestId: string, body: object) {
    try {
      await api(`events/${event!.id}/logistics/guests/${guestId}`, {
        method: "PUT",
        body: json(body),
      });
      await data.reload();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  async function remove(kind: string, id: string) {
    if (
      !window.confirm("Remove this? Guests assigned to it are kept unassigned.")
    )
      return;
    await api(`events/${event!.id}/logistics/${kind}/${id}`, {
      method: "DELETE",
    }).catch((e) => notify(e.message, true));
    await data.reload();
  }
  const travel = (guestId: string) =>
    data.data?.travelers.find((t) => t.guestId === guestId);
  return (
    <>
      <PageHeading
        eyebrow="অতিথির যাতায়াত ও থাকা"
        title="Guest travel & stay"
        description="Rooms and vehicles for guests coming from outside the city."
        action={
          !readOnly && (
            <div className="button-group">
              <Button variant="secondary" onClick={() => setForm("stay")}>
                <BedDouble size={17} /> Add a stay
              </Button>
              <Button variant="secondary" onClick={() => setForm("vehicle")}>
                <Bus size={17} /> Add a vehicle
              </Button>
            </div>
          )
        }
      />
      <div className="side-grid">
        <section className="card padded">
          <CardHeading title="Stays" />
          {data.data?.accommodations.map((a) => (
            <div key={a.id} className="capacity-row">
              <div>
                <strong>{a.name}</strong>
                <small className="block muted">
                  {[a.address, a.contact].filter(Boolean).join(" · ")}
                </small>
              </div>
              <span className={a.assignedPeople > a.capacity ? "over" : ""}>
                {a.assignedPeople}/{a.capacity}
              </span>
              {!readOnly && (
                <button
                  className="icon-button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => void remove("accommodations", a.id)}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          {!data.data?.accommodations.length && (
            <p className="muted">No stays yet.</p>
          )}
        </section>
        <section className="card padded">
          <CardHeading title="Vehicles" />
          {data.data?.transports.map((v) => (
            <div key={v.id} className="capacity-row">
              <div>
                <strong>{v.label}</strong>
                <small className="block muted">
                  {[v.driverName, v.driverPhone, v.route]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
              <span>
                {v.assignedPeople}/{v.capacity}
              </span>
              {!readOnly && (
                <button
                  className="icon-button"
                  aria-label={`Remove ${v.label}`}
                  onClick={() => void remove("transports", v.id)}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          {!data.data?.transports.length && (
            <p className="muted">No vehicles yet.</p>
          )}
        </section>
      </div>
      <section className="card table-card">
        <CardHeading
          title="Who stays where"
          subtitle="Assign guests who need a room or a ride."
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Guest</th>
                <th>Coming from</th>
                <th>Stay</th>
                <th>Vehicle</th>
              </tr>
            </thead>
            <tbody>
              {accepted.map((g) => {
                const t = travel(g.id);
                return (
                  <tr key={g.id}>
                    <td>
                      <strong>{g.name}</strong>
                      <small className="block muted">
                        party of {g.partySize}
                      </small>
                    </td>
                    <td>
                      <input
                        aria-label={`${g.name} coming from`}
                        defaultValue={t?.fromCity || ""}
                        disabled={readOnly}
                        placeholder="Chattogram"
                        onBlur={(e) =>
                          e.target.value !== (t?.fromCity || "") &&
                          void assign(g.id, {
                            fromCity: e.target.value || null,
                          })
                        }
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`${g.name} stay`}
                        disabled={readOnly}
                        value={t?.accommodationId || ""}
                        onChange={(e) =>
                          void assign(g.id, {
                            accommodationId: e.target.value || null,
                          })
                        }
                      >
                        <option value="">—</option>
                        {data.data?.accommodations.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`${g.name} vehicle`}
                        disabled={readOnly}
                        value={t?.transportId || ""}
                        onChange={(e) =>
                          void assign(g.id, {
                            transportId: e.target.value || null,
                          })
                        }
                      >
                        <option value="">—</option>
                        {data.data?.transports.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!accepted.length && <Empty title="No guests yet" />}
      </section>
      {form && (
        <Modal
          title={form === "stay" ? "Add a stay" : "Add a vehicle"}
          onClose={() => setForm(null)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget));
              setBusy(true);
              try {
                if (form === "stay")
                  await api(`events/${event.id}/logistics/accommodations`, {
                    method: "POST",
                    body: json({
                      name: f.name,
                      address: f.address || undefined,
                      rooms: Number(f.rooms || 1),
                      capacity: Number(f.capacity || 2),
                      contact: f.contact || undefined,
                    }),
                  });
                else
                  await api(`events/${event.id}/logistics/transports`, {
                    method: "POST",
                    body: json({
                      label: f.label,
                      capacity: Number(f.capacity || 4),
                      driverName: f.driverName || undefined,
                      driverPhone: f.driverPhone || undefined,
                      route: f.route || undefined,
                    }),
                  });
                await data.reload();
                setForm(null);
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            {form === "stay" ? (
              <>
                <Field label="Name">
                  <input
                    name="name"
                    required
                    placeholder="Hotel Agrabad / Mama's house"
                  />
                </Field>
                <Field label="Address">
                  <input name="address" />
                </Field>
                <div className="form-row">
                  <Field label="Rooms">
                    <input
                      name="rooms"
                      type="number"
                      min="1"
                      defaultValue="1"
                    />
                  </Field>
                  <Field label="People it can hold">
                    <input
                      name="capacity"
                      type="number"
                      min="1"
                      defaultValue="2"
                    />
                  </Field>
                </div>
                <Field label="Contact">
                  <input name="contact" />
                </Field>
              </>
            ) : (
              <>
                <Field label="Vehicle">
                  <input name="label" required placeholder="Microbus 1" />
                </Field>
                <Field label="Seats">
                  <input
                    name="capacity"
                    type="number"
                    min="1"
                    defaultValue="10"
                  />
                </Field>
                <div className="form-row">
                  <Field label="Driver">
                    <input name="driverName" />
                  </Field>
                  <Field label="Driver phone">
                    <input name="driverPhone" />
                  </Field>
                </div>
                <Field label="Route">
                  <input name="route" placeholder="Airport → venue" />
                </Field>
              </>
            )}
            <Button busy={busy}>
              <Plus size={16} /> Save
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
