"use client";
import { use, useEffect, useRef, useState } from "react";
import "@/app/tools.css";
import { api } from "@/lib/api";

type Photo = {
  id: string;
  url: string;
  uploaderName?: string;
  caption?: string;
  createdAt: string;
};

/** Full-screen slideshow for the venue screen. New approved photos join automatically. */
export default function LiveWall({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [photos, setPhotos] = useState<Photo[]>([]),
    [title, setTitle] = useState(""),
    [index, setIndex] = useState(0),
    [error, setError] = useState("");
  const latest = useRef<string | undefined>(undefined);
  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const wall = await api<{ title: string; photos: Photo[] }>(
          `photo-wall/${token}${latest.current ? `?after=${encodeURIComponent(latest.current)}` : ""}`,
        );
        if (stop) return;
        setTitle(wall.title);
        if (wall.photos.length) {
          latest.current = wall.photos[0].createdAt;
          setPhotos((current) =>
            [
              ...wall.photos.filter((p) => !current.some((c) => c.id === p.id)),
              ...current,
            ].slice(0, 300),
          );
        }
        setError("");
      } catch (e) {
        setError((e as Error).message);
      }
    }
    void poll();
    const timer = setInterval(poll, 15000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [token]);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => i + 1), 6000);
    return () => clearInterval(timer);
  }, []);
  const photo = photos.length ? photos[index % photos.length] : null;
  return (
    <main
      className="live-wall"
      onClick={() =>
        document.documentElement.requestFullscreen?.().catch(() => undefined)
      }
    >
      {photo ? (
        <figure key={photo.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={photo.caption || "Guest photo"} />
          <figcaption>
            {photo.caption && <span>{photo.caption}</span>}
            {photo.uploaderName && <small>📷 {photo.uploaderName}</small>}
          </figcaption>
        </figure>
      ) : (
        <div className="live-empty">
          <h1>{title}</h1>
          <p>{error || "Scan the QR code on your table to share photos."}</p>
        </div>
      )}
    </main>
  );
}
