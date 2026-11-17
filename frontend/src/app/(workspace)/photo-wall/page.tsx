"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, EyeOff, MonitorPlay, QrCode } from "lucide-react";
import "@/app/tools.css";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import {
  Badge,
  Button,
  CardHeading,
  Empty,
  PageHeading,
} from "@/components/ui";

type Photo = {
  id: string;
  url: string;
  uploaderName?: string;
  caption?: string;
  status: string;
  createdAt: string;
};
type Wall = {
  token: string | null;
  uploadUrl: string | null;
  slideshowUrl: string | null;
  moderation: boolean;
  photos: Photo[];
};

export default function PhotoWall() {
  const { event, notify } = useApp();
  const [status, setStatus] = useState("PENDING");
  const wall = useResource<Wall | null>(
    event ? `events/${event.id}/photo-wall?status=${status}` : null,
    null,
  );
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (wall.data?.uploadUrl)
      void QRCode.toDataURL(wall.data.uploadUrl, {
        margin: 1,
        width: 480,
      }).then(setQr);
    else setQr("");
  }, [wall.data?.uploadUrl]);
  if (!event) return <Empty title="Create a celebration first" />;
  const readOnly = event.access === "VIEWER";
  async function settings(body: object) {
    try {
      await api(`events/${event!.id}/photo-wall/settings`, {
        method: "POST",
        body: json(body),
      });
      await wall.reload();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  async function moderate(id: string, next: string) {
    await api(`events/${event!.id}/photo-wall/${id}`, {
      method: "PATCH",
      body: json({ status: next }),
    }).catch((e) => notify(e.message, true));
    await wall.reload();
  }
  const w = wall.data;
  return (
    <>
      <PageHeading
        eyebrow="ফটো ওয়াল"
        title="Photo wall"
        description="Guests scan a QR code and share photos. Approved photos play live on a screen."
      />
      <section className="card padded photo-setup">
        {w?.token ? (
          <>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR code guests scan to upload photos"
                className="photo-qr"
              />
            )}
            <div>
              <CardHeading
                title="Print this QR for the tables"
                subtitle={w.uploadUrl || ""}
              />
              <div className="button-group">
                <a
                  className="button secondary"
                  href={w.slideshowUrl!}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MonitorPlay size={17} /> Open live slideshow
                </a>
                {qr && (
                  <a
                    className="button secondary"
                    href={qr}
                    download="photo-wall-qr.png"
                  >
                    <QrCode size={17} /> Download QR
                  </a>
                )}
              </div>
              {!readOnly && (
                <>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={w.moderation}
                      onChange={(e) =>
                        void settings({
                          enabled: true,
                          moderation: e.target.checked,
                        })
                      }
                    />
                    <span>Approve photos before they appear</span>
                  </label>
                  <div className="button-group">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void settings({
                          enabled: true,
                          moderation: w.moderation,
                          rotate: true,
                        })
                      }
                    >
                      New QR code (old one stops working)
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => void settings({ enabled: false })}
                    >
                      Close the photo wall
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div>
            <p>The photo wall is closed.</p>
            {!readOnly && (
              <Button
                onClick={() =>
                  void settings({ enabled: true, moderation: true })
                }
              >
                Open the photo wall
              </Button>
            )}
          </div>
        )}
      </section>
      <div className="tabs">
        {[
          ["PENDING", "Waiting for approval"],
          ["APPROVED", "On the wall"],
          ["HIDDEN", "Hidden"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={status === v ? "selected" : ""}
            onClick={() => setStatus(v)}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="photo-grid">
        {w?.photos.map((p) => (
          <figure key={p.id} className="photo-tile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.caption || `Photo from ${p.uploaderName || "a guest"}`}
              loading="lazy"
            />
            <figcaption>
              <span>{p.uploaderName || "Guest"}</span>
              <Badge value={p.status} />
              {!readOnly && p.status !== "APPROVED" && (
                <button
                  className="icon-button"
                  aria-label="Approve"
                  onClick={() => void moderate(p.id, "APPROVED")}
                >
                  <Check size={16} />
                </button>
              )}
              {!readOnly && p.status !== "HIDDEN" && (
                <button
                  className="icon-button"
                  aria-label="Hide"
                  onClick={() => void moderate(p.id, "HIDDEN")}
                >
                  <EyeOff size={16} />
                </button>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
      {!w?.photos.length && <Empty title="No photos here yet" />}
    </>
  );
}
