"use client";
import { use, useEffect, useState } from "react";
import { Camera, Check, Languages } from "lucide-react";
import "@/app/tools.css";
import { api, json } from "@/lib/api";
import { usePublicLocale } from "@/lib/public-i18n";
import { Button, Field } from "@/components/ui";

/** Guests reach this page from the table QR code. No account needed. */
export default function SharePhotos({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { locale, t, toggle } = usePublicLocale();
  const [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(0),
    [name, setName] = useState("");
  useEffect(() => {
    void api<{ title: string }>(`photo-wall/${token}`)
      .then((w) => setTitle(w.title))
      .catch((e) => setError(e.message));
  }, [token]);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    let count = 0;
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        const slot = await api<{
          id: string;
          upload: {
            method: string;
            url: string;
            fields?: Record<string, string>;
            headers?: Record<string, string>;
          };
        }>(`photo-wall/${token}/uploads`, {
          method: "POST",
          body: json({
            contentType: file.type,
            sizeBytes: file.size,
            fileName: file.name,
          }),
        });
        if (slot.upload.method === "POST") {
          const form = new FormData();
          Object.entries(slot.upload.fields || {}).forEach(([k, v]) =>
            form.append(k, v),
          );
          form.append("file", file);
          await fetch(slot.upload.url, { method: "POST", body: form });
        } else
          await fetch(slot.upload.url, {
            method: "PUT",
            body: file,
            headers: slot.upload.headers,
          });
        await api(`photo-wall/${token}/uploads/${slot.id}/complete`, {
          method: "POST",
          body: json({ uploaderName: name || undefined }),
        });
        count++;
      }
      setDone((n) => n + count);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="rsvp-page" lang={locale}>
      <div className="rsvp-top">
        <span className="brand">
          utsab<span>✳</span>
        </span>
        <button className="link-button" onClick={toggle}>
          <Languages size={16} /> {t.language}
        </button>
      </div>
      <section className="rsvp-card">
        <Camera size={32} />
        <span className="eyebrow">{title}</span>
        <h1>{t.photosTitle}</h1>
        <p className="rsvp-intro">{t.photosIntro}</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {done > 0 && (
          <p className="form-success" role="status">
            <Check size={16} /> {t.uploaded} ({done})
          </p>
        )}
        {!error || title ? (
          <div className="form-stack">
            <Field label={t.yourName}>
              <input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <label className="button primary upload-button">
              {busy ? t.uploading : t.choosePhotos}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                disabled={busy}
                onChange={(e) => void upload(e.target.files)}
              />
            </label>
          </div>
        ) : null}
      </section>
    </main>
  );
}
