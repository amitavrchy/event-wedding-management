"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, QrCode, Check, Search, RotateCcw } from "lucide-react";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { useAction, useResource } from "@/lib/use-resource";
import { Guest } from "@/lib/types";
import { Button, Empty, Field, Modal, PageHeading } from "@/components/ui";
import { GuestPass } from "@/components/guest-pass";
type Entry = { id: string; partySize: number; createdAt: string; guest: Guest };
export default function CheckIn() {
  const { event, notify } = useApp();
  const [day, setDay] = useState(""),
    [token, setToken] = useState(""),
    [search, setSearch] = useState(""),
    [pass, setPass] = useState<Guest | null>(null),
    [scanning, setScanning] = useState(false);
  const dayId = day || event?.days[0]?.id;
  const { data, reload } = useResource<Entry[]>(
    event && dayId ? `events/${event.id}/check-in/${dayId}` : null,
    [],
  );
  const { busy, run } = useAction();
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<{ stop: () => void } | null>(null);
  useEffect(
    () => () => {
      controls.current?.stop();
    },
    [],
  );
  async function check(value: string) {
    let raw = value.trim();
    try {
      if (raw.startsWith("http"))
        raw = new URL(raw).pathname.split("/").pop() || "";
    } catch {}
    await run(async () => {
      const result = await api<{
        duplicate: boolean;
        guest: Guest;
        capacityWarning?: boolean;
      }>(`events/${event!.id}/check-in/${dayId}`, {
        method: "POST",
        body: json({ token: raw }),
      });
      await reload();
      setToken("");
      notify(
        result.duplicate
          ? `${result.guest.name} is already checked in`
          : `Welcome, ${result.guest.name}!${result.capacityWarning ? " Venue capacity exceeded." : ""}`,
      );
    });
  }
  async function start() {
    setScanning(true);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      controls.current = await reader.decodeFromVideoDevice(
        undefined,
        video.current!,
        (result) => {
          if (result) {
            controls.current?.stop();
            setScanning(false);
            setToken(result.getText());
          }
        },
      );
    } catch (e) {
      setScanning(false);
      notify(
        "Camera unavailable. Paste an invitation link or choose a guest below.",
        true,
      );
    }
  }
  if (!event)
    return <Empty title="Create a celebration to welcome your guests" />;
  const accepted = (event.guests || []).filter(
    (g) => g.rsvpStatus === "ACCEPTED",
  );
  return (
    <>
      <PageHeading
        eyebrow="A WARM WELCOME, WITHOUT THE WAIT"
        title="Your guest welcome desk"
        description="Scan a celebration pass or find a guest. Duplicate arrivals are safely detected."
      />
      <div className="tabs">
        {event.days.map((d) => (
          <button
            key={d.id}
            className={d.id === dayId ? "selected" : ""}
            onClick={() => setDay(d.id)}
          >
            {d.name}
          </button>
        ))}
      </div>
      <div className="advanced-metrics">
        <div>
          <Check />
          <strong>{data.reduce((s, e) => s + e.partySize, 0)}</strong>
          <span>People welcomed</span>
        </div>
        <div>
          <strong>{accepted.reduce((s, g) => s + g.partySize, 0)}</strong>
          <span>Confirmed guests</span>
        </div>
        <div>
          <strong>{data.length}</strong>
          <span>Parties checked in</span>
        </div>
        <div>
          <strong>{event.guestCapacity}</strong>
          <span>Venue capacity</span>
        </div>
      </div>
      <div className="checkin-grid">
        <section className="card scanner-card">
          <QrCode size={38} />
          <h2>Every welcome starts here.</h2>
          <p>Scan a QR invitation, paste its link, or enter the guest token.</p>
          <video
            ref={video}
            hidden={!scanning}
            className="scanner-preview"
            muted
            playsInline
          />
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void check(token);
            }}
          >
            <Field label="Invitation link or guest token">
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste an invitation link"
                required
              />
            </Field>
            <Button disabled={!dayId} busy={busy}>
              Welcome this guest
            </Button>
          </form>
          <Button
            variant="secondary"
            disabled={!dayId}
            onClick={() => {
              if (scanning) {
                controls.current?.stop();
                setScanning(false);
              } else void start();
            }}
          >
            <Camera size={17} />
            {scanning ? "Stop camera" : "Scan with camera"}
          </Button>
          <p className="helper-text">
            Camera access starts only when you choose Scan. On HTTPS or
            localhost, supported cameras can read invitation QR codes.
          </p>
        </section>
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Your guest list</h2>
              <p>One click for a thoughtful welcome.</p>
            </div>
          </div>
          <div className="search-field seating-search">
            <Search size={17} />
            <input
              aria-label="Find a check-in guest"
              placeholder="Find a confirmed guest"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="seating-guests">
            {accepted
              .filter((g) =>
                g.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((g) => (
                <div className="seat-guest" key={g.id}>
                  <div>
                    <strong>{g.name}</strong>
                    <small>
                      Party of {g.partySize} ·{" "}
                      {g.tableLabel || "Seating to be assigned"}
                    </small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Show ${g.name} invitation pass`}
                    onClick={() => setPass(g)}
                  >
                    <QrCode size={17} />
                  </button>
                  <Button
                    variant={
                      data.some((e) => e.guest?.id === g.id)
                        ? "ghost"
                        : "secondary"
                    }
                    busy={busy}
                    disabled={!dayId}
                    onClick={() => void check(g.token)}
                  >
                    {data.some((e) => e.guest?.id === g.id)
                      ? "Arrived"
                      : "Check in"}
                  </Button>
                </div>
              ))}
          </div>
        </section>
      </div>
      <section className="card section-gap">
        <div className="card-heading">
          <h2>Arrival log</h2>
          <span>Times shown in Asia/Dhaka</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Guest</th>
                <th>Party</th>
                <th>Arrival</th>
                <th>Correction</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td>{e.guest?.name || "Guest"}</td>
                  <td>{e.partySize}</td>
                  <td>
                    {new Date(e.createdAt).toLocaleTimeString("en-GB", {
                      timeZone: "Asia/Dhaka",
                    })}
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      busy={busy}
                      onClick={() =>
                        void run(async () => {
                          await api(`events/${event.id}/check-in/${e.id}`, {
                            method: "DELETE",
                          });
                          await reload();
                        }, "Check-in undone")
                      }
                    >
                      <RotateCcw size={15} />
                      Undo
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.length && <Empty title="Your first warm welcome is waiting" />}
      </section>
      {pass && (
        <Modal title={pass.name} onClose={() => setPass(null)}>
          <GuestPass token={pass.token} name={pass.name} />
        </Modal>
      )}
    </>
  );
}
