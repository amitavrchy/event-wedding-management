"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Store, Plus, CalendarDays, FileText } from "lucide-react";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { localDateToISO } from "@/lib/format";
import { Vendor } from "@/lib/types";
import {
  Button,
  CardHeading,
  Empty,
  Field,
  PageHeading,
} from "@/components/ui";
export default function Studio() {
  const { user, notify, refresh, vendors } = useApp();
  const [tab, setTab] = useState("business"),
    [busy, setBusy] = useState(false),
    [vendorId, setVendorId] = useState("");
  const [businesses, setBusinesses] = useState<Vendor[]>([]),
    [clients, setClients] = useState<{ id: string; title: string }[]>([]);
  async function loadBusinesses() {
    try {
      const mine = await api<Vendor[]>("vendors/mine");
      setBusinesses(mine);
      setVendorId((current) => current || mine[0]?.id || "");
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  useEffect(() => {
    if (user?.role === "VENDOR") void loadBusinesses();
  }, [user]);
  useEffect(() => {
    if (!vendorId) return;
    void api<typeof clients>(`vendors/${vendorId}/clients`)
      .then(setClients)
      .catch((e) => notify(e.message, true));
  }, [vendorId, notify]);
  if (user?.role !== "VENDOR")
    return <Empty title="This space is for wedding professionals" />;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    let path = "vendors",
      body: unknown = Object.fromEntries(f);
    if (tab === "service") {
      path = `vendors/${vendorId}/services`;
      body = {
        title: f.get("title"),
        basePriceMinor: Math.round(Number(f.get("price")) * 100),
        durationHours: Number(f.get("duration")),
        bufferHours: Number(f.get("buffer")),
        capacity: f.get("capacity") ? Number(f.get("capacity")) : undefined,
      };
    }
    if (tab === "calendar") {
      path = `vendors/${vendorId}/blocks`;
      body = {
        serviceId: f.get("serviceId"),
        startAt: localDateToISO(String(f.get("startAt"))),
        endAt: localDateToISO(String(f.get("endAt"))),
        reason: f.get("reason"),
      };
    }
    if (tab === "quote") {
      path = "quotes";
      body = {
        vendorId,
        eventId: f.get("eventId"),
        amountMinor: Math.round(Number(f.get("amount")) * 100),
        breakdown: [
          {
            label: f.get("label"),
            amountMinor: Math.round(Number(f.get("amount")) * 100),
          },
        ],
        expiresAt: localDateToISO(String(f.get("expiresAt"))),
      };
    }
    try {
      const result = await api<{ id: string }>(path, {
        method: "POST",
        body: json(body),
      });
      if (tab === "business") setVendorId(result.id);
      await loadBusinesses();
      await refresh();
      notify(
        tab === "business"
          ? "Application received. An administrator must activate your business."
          : "Your changes have been saved",
      );
      form.reset();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR CRAFT. THEIR FOREVER."
        title="Vendor studio"
        description="Thoughtful tools for the professionals behind unforgettable days."
      />
      <div className="info-note">
        <Store size={20} />
        <span>
          New businesses need administrator approval. Choose your business below
          to add services or manage dates. Your clients appear after they start
          a conversation with you.
        </span>
      </div>
      <div className="tabs">
        {[
          ["business", "Business application"],
          ["service", "Add a service"],
          ["calendar", "Calendar blocks"],
          ["quote", "Send a quote"],
        ].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={tab === v ? "selected" : ""}
          >
            {l}
          </button>
        ))}
      </div>
      <section className="card studio-form">
        <CardHeading
          title={
            tab === "business"
              ? "Introduce your business"
              : tab === "service"
                ? "Make your expertise bookable"
                : tab === "calendar"
                  ? "Make room in your calendar"
                  : "A celebration, made personal"
          }
        />
        <form className="form-stack padded" onSubmit={submit}>
          {tab !== "business" && (
            <Field label="Your business">
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                required
              >
                <option value="">Choose a business</option>
                {businesses.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.businessName} · {v.status.toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {tab === "business" && (
            <>
              <Field label="Business name">
                <input
                  name="businessName"
                  minLength={2}
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="Unique business URL slug">
                <input
                  name="slug"
                  required
                  pattern="[a-z0-9-]+"
                  placeholder="your-business-name"
                />
              </Field>
              <Field label="Category">
                <select name="category">
                  {[
                    "Venue",
                    "Photography",
                    "Catering",
                    "Decoration",
                    "Makeup",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="City">
                <input name="city" defaultValue="Dhaka" required />
              </Field>
              <Field label="Your story">
                <textarea
                  name="description"
                  minLength={20}
                  maxLength={3000}
                  required
                />
              </Field>
              <Field label="Portfolio cover image URL">
                <input type="url" name="image" required />
              </Field>
            </>
          )}
          {tab === "service" && (
            <>
              <Field label="Service title">
                <input name="title" required minLength={2} />
              </Field>
              <Field label="Starting price (৳)">
                <input
                  name="price"
                  type="number"
                  min="0"
                  max="20000000"
                  required
                />
              </Field>
              <div className="form-row">
                <Field label="Duration in hours">
                  <input
                    name="duration"
                    type="number"
                    min="1"
                    max="72"
                    defaultValue="6"
                    required
                  />
                </Field>
                <Field label="Setup buffer in hours">
                  <input
                    name="buffer"
                    type="number"
                    min="0"
                    max="24"
                    defaultValue="2"
                    required
                  />
                </Field>
              </div>
              <Field label="Capacity (optional)">
                <input name="capacity" type="number" min="1" />
              </Field>
            </>
          )}
          {tab === "calendar" && (
            <>
              <Field label="Service">
                <select name="serviceId" required>
                  {businesses
                    .find((v) => v.id === vendorId)
                    ?.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Unavailable from (Asia/Dhaka)">
                <input name="startAt" type="datetime-local" required />
              </Field>
              <Field label="Unavailable until (Asia/Dhaka)">
                <input name="endAt" type="datetime-local" required />
              </Field>
              <Field label="Reason">
                <input name="reason" maxLength={200} />
              </Field>
            </>
          )}
          {tab === "quote" && (
            <>
              <Field label="Client celebration">
                <select name="eventId" required>
                  <option value="">Choose a client celebration</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quote description">
                <input name="label" required />
              </Field>
              <Field label="Total amount (৳)">
                <input
                  name="amount"
                  type="number"
                  min="0"
                  max="20000000"
                  required
                />
              </Field>
              <Field label="Valid until (Asia/Dhaka)">
                <input name="expiresAt" type="datetime-local" required />
              </Field>
            </>
          )}
          <Button busy={busy}>
            <Plus size={18} />
            Save{" "}
            {tab === "business"
              ? "application"
              : tab === "calendar"
                ? "calendar block"
                : tab}
          </Button>
        </form>
      </section>
      <div className="button-group section-gap">
        <Link href="/bookings" className="button secondary">
          <CalendarDays size={18} />
          Manage bookings
        </Link>
        <Link href="/messages" className="button secondary">
          <FileText size={18} />
          Client conversations
        </Link>
      </div>
      <details className="calendar-details section-gap">
        <summary>Your published services</summary>
        {businesses.map((v) => (
          <p key={v.id}>
            {v.businessName}: {v.services.map((s) => s.title).join(", ")}
          </p>
        ))}
      </details>
    </>
  );
}
