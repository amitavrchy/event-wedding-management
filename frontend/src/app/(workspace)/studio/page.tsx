"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  ImagePlus,
  Pencil,
  Plus,
  Receipt,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import "@/app/tools.css";
import { useApp } from "@/lib/context";
import { api, json, uploadFile } from "@/lib/api";
import { dateLabel, localDateToISO, taka } from "@/lib/format";
import type { Paged, Service } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { useBusiness } from "@/lib/use-business";
import {
  Badge,
  Button,
  CardHeading,
  Empty,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";

type Plan = {
  code: string;
  name: string;
  priceMinor: number;
  periodDays: number;
  entitlements: { maxPhotos: number; maxServices: number; featured: boolean };
};
type SubPayment = {
  id: string;
  method: string;
  reference: string;
  amountMinor: number;
  status: string;
  receiptNumber?: string;
  note?: string;
  createdAt: string;
};
type Subscription = {
  id: string;
  planCode: string;
  status: string;
  startsAt?: string;
  endsAt?: string;
  payments: SubPayment[];
};
type SubState = {
  planCode: string | null;
  active: Subscription | null;
  open: Subscription | null;
  history: Subscription[];
  instructions: {
    bkash: string | null;
    nagad: string | null;
    bank: string | null;
    note: string;
  };
};
type Verification = {
  verifiedAt: string | null;
  requests: {
    id: string;
    documentType: string;
    status: string;
    note?: string;
    createdAt: string;
  }[];
};
type Review = {
  id: string;
  rating: number;
  body: string;
  reply?: string;
  status: string;
  createdAt: string;
};
const TABS = [
  ["profile", "Profile"],
  ["services", "Services"],
  ["portfolio", "Portfolio"],
  ["plan", "Plan"],
  ["verification", "Verification"],
  ["reviews", "Reviews"],
  ["quote", "Send a quote"],
  ["calendar", "Block dates"],
] as const;

function StudioPage() {
  const { user, notify } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") || "profile";
  const categories = useResource<{ id: string; name: string }[]>(
    "categories",
    [],
  );
  const {
    businesses,
    business: vendor,
    choose: setVendorId,
    reloadBusinesses,
    loading,
  } = useBusiness();
  const mine = { data: businesses, reload: reloadBusinesses, loading };
  const vendorId = vendor?.id || "";
  const [busy, setBusy] = useState(""),
    [service, setService] = useState<Service | "new" | null>(null);
  const plans = useResource<Plan[]>("plans", []);
  const sub = useResource<SubState | null>(
    vendor && tab === "plan" ? `vendors/${vendor.id}/subscription` : null,
    null,
  );
  const verification = useResource<Verification | null>(
    vendor && tab === "verification"
      ? `vendors/${vendor.id}/verification`
      : null,
    null,
  );
  const reviews = useResource<Paged<Review> | null>(
    vendor && tab === "reviews" ? `reviews/vendor/${vendor.id}` : null,
    null,
  );
  const clients = useResource<{ id: string; title: string }[]>(
    vendor && tab === "quote" ? `vendors/${vendor.id}/clients` : null,
    [],
  );
  const [lines, setLines] = useState([{ label: "", amount: "" }]);
  if (user?.role !== "VENDOR")
    return <Empty title="This space is for event professionals" />;

  async function run(
    key: string,
    action: () => Promise<unknown>,
    message?: string,
  ) {
    setBusy(key);
    try {
      await action();
      if (message) notify(message);
      return true;
    } catch (e) {
      notify((e as Error).message, true);
      return false;
    } finally {
      setBusy("");
    }
  }
  const setTab = (t: string) => router.replace(`/studio?tab=${t}`);
  const form = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return new FormData(e.currentTarget);
  };

  if (!mine.loading && !mine.data.length)
    return (
      <>
        <PageHeading
          eyebrow="YOUR CRAFT. THEIR FOREVER."
          title="List your business"
          description="Tell families who you are. Our team reviews every new listing."
        />
        <section className="card padded">
          <form
            className="form-stack"
            onSubmit={(e) => {
              const f = form(e);
              void run(
                "create",
                async () => {
                  const created = await api<{ id: string }>("vendors", {
                    method: "POST",
                    body: json(Object.fromEntries(f)),
                  });
                  await mine.reload();
                  setVendorId(created.id);
                },
                "Application received. We will review it shortly.",
              );
            }}
          >
            <Field label="Business name">
              <input name="businessName" required minLength={2} />
            </Field>
            <Field label="Profile address (letters, numbers and dashes)">
              <input
                name="slug"
                required
                pattern="[a-z0-9-]+"
                placeholder="dhaka-dream-photography"
              />
            </Field>
            <div className="form-row">
              <Field label="Category">
                <select name="category" required>
                  {categories.data.map((c) => (
                    <option key={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="City">
                <input name="city" defaultValue="Dhaka" required />
              </Field>
            </div>
            <Field label="About your business">
              <textarea
                name="description"
                required
                minLength={20}
                maxLength={3000}
                rows={5}
              />
            </Field>
            <Button busy={busy === "create"}>Submit for review</Button>
          </form>
        </section>
      </>
    );

  return (
    <>
      <PageHeading
        eyebrow="YOUR CRAFT. THEIR FOREVER."
        title="Profile & services"
        description="Everything families see about your business."
        action={
          vendor && (
            <Link
              className="button secondary"
              href={`/v/${vendor.slug}`}
              target="_blank"
            >
              View public profile
            </Link>
          )
        }
      />
      {mine.data.length > 1 && (
        <Field label="Business">
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            {mine.data.map((v) => (
              <option key={v.id} value={v.id}>
                {v.businessName}
              </option>
            ))}
          </select>
        </Field>
      )}
      {vendor && vendor.status !== "ACTIVE" && (
        <div className="info-note">
          Your listing is {vendor.status?.toLowerCase()}.{" "}
          {vendor.status === "APPLIED"
            ? "We review new businesses within two working days."
            : "Contact support to restore it."}
        </div>
      )}
      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "selected" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {!vendor ? null : tab === "profile" ? (
        <section className="card padded">
          <form
            key={vendor.id}
            className="form-stack"
            onSubmit={(e) => {
              const f = form(e);
              void run(
                "profile",
                async () => {
                  await api(`vendors/${vendor.id}`, {
                    method: "PATCH",
                    body: json({
                      businessName: f.get("businessName"),
                      category: f.get("category"),
                      city: f.get("city"),
                      phone: f.get("phone") || null,
                      description: f.get("description"),
                      serviceAreas: String(f.get("areas") || "")
                        .split(",")
                        .map((a) => a.trim())
                        .filter(Boolean),
                    }),
                  });
                  await mine.reload();
                },
                "Profile saved",
              );
            }}
          >
            <Field label="Business name">
              <input
                name="businessName"
                defaultValue={vendor.businessName}
                required
                minLength={2}
              />
            </Field>
            <div className="form-row">
              <Field label="Category">
                <select name="category" defaultValue={vendor.category}>
                  {categories.data.map((c) => (
                    <option key={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="City">
                <input name="city" defaultValue={vendor.city} required />
              </Field>
            </div>
            <Field label="Areas you serve (comma separated)">
              <input
                name="areas"
                defaultValue={vendor.serviceAreas?.join(", ")}
                placeholder="Dhanmondi, Gulshan, Uttara"
              />
            </Field>
            <Field label="Business phone (shared with families after they contact you)">
              <input
                name="phone"
                type="tel"
                defaultValue={vendor.phone || ""}
              />
            </Field>
            <Field label="About your business">
              <textarea
                name="description"
                defaultValue={vendor.description}
                required
                minLength={20}
                maxLength={3000}
                rows={6}
              />
            </Field>
            <Button busy={busy === "profile"}>Save profile</Button>
          </form>
        </section>
      ) : tab === "services" ? (
        <section className="card table-card">
          <CardHeading
            title="Services"
            subtitle="Price, duration and the time you need between bookings."
            action={
              <Button onClick={() => setService("new")}>
                <Plus size={16} /> Add a service
              </Button>
            }
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Price</th>
                  <th>Duration</th>
                  <th>Capacity</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {vendor.services
                  .filter((s) => s.active !== false)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.title}</strong>
                        {s.description && (
                          <small className="block muted">{s.description}</small>
                        )}
                      </td>
                      <td>{taka(s.basePriceMinor)}</td>
                      <td>
                        {s.durationHours} h + {s.bufferHours} h buffer
                      </td>
                      <td>{s.capacity || "—"}</td>
                      <td className="row-actions">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${s.title}`}
                          onClick={() => setService(s)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Remove ${s.title}`}
                          onClick={() =>
                            window.confirm(`Remove ${s.title}?`) &&
                            void run(
                              "rm",
                              async () => {
                                await api(
                                  `vendors/${vendor.id}/services/${s.id}`,
                                  { method: "DELETE" },
                                );
                                await mine.reload();
                              },
                              "Service removed",
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : tab === "portfolio" ? (
        <section className="card padded">
          <CardHeading
            title="Portfolio"
            subtitle="Your cover photo and gallery. JPEG, PNG or WebP up to 8 MB."
          />
          <div className="form-stack">
            <label className="button secondary upload-button">
              <Upload size={16} />{" "}
              {busy === "cover" ? "Uploading…" : "Change cover photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void run(
                      "cover",
                      async () => {
                        const media = await uploadFile(
                          file,
                          "VENDOR_PORTFOLIO",
                        );
                        await api(`vendors/${vendor.id}`, {
                          method: "PATCH",
                          body: json({ imageMediaId: media.id }),
                        });
                        await mine.reload();
                      },
                      "Cover photo updated",
                    );
                }}
              />
            </label>
            <div className="gallery-editor">
              {(vendor.gallery || []).map((url) => (
                <figure key={url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" />
                  <button
                    className="icon-button"
                    aria-label="Remove photo"
                    onClick={() =>
                      void run("gallery", async () => {
                        await api(`vendors/${vendor.id}`, {
                          method: "PATCH",
                          body: json({
                            gallery: (vendor.gallery || []).filter(
                              (g) => g !== url,
                            ),
                          }),
                        });
                        await mine.reload();
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </figure>
              ))}
              <label
                className="button ghost upload-button"
                style={{ aspectRatio: "1" }}
              >
                <ImagePlus size={22} />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length)
                      void run(
                        "gallery",
                        async () => {
                          const ids: string[] = [];
                          for (const file of files)
                            ids.push(
                              (await uploadFile(file, "VENDOR_PORTFOLIO")).id,
                            );
                          await api(`vendors/${vendor.id}`, {
                            method: "PATCH",
                            body: json({
                              gallery: [...(vendor.gallery || []), ...ids],
                            }),
                          });
                          await mine.reload();
                        },
                        "Photos added",
                      );
                  }}
                />
              </label>
            </div>
          </div>
        </section>
      ) : tab === "plan" ? (
        <section className="card padded">
          <CardHeading
            title="Your plan"
            subtitle={
              sub.data?.active
                ? `${sub.data.active.planCode} until ${dateLabel(sub.data.active.endsAt!)}`
                : "Free listing: 6 photos and 3 services. Upgrade for more visibility."
            }
          />
          <div className="plan-grid">
            {plans.data.map((p) => (
              <article
                key={p.code}
                className={`plan-card ${sub.data?.planCode === p.code ? "current" : ""}`}
              >
                <h3>{p.name}</h3>
                <strong className="price">{taka(p.priceMinor)}</strong>
                <span className="muted">every {p.periodDays} days</span>
                <ul>
                  <li>{p.entitlements.maxPhotos} portfolio photos</li>
                  <li>{p.entitlements.maxServices} services</li>
                  {p.entitlements.featured && (
                    <li>Sponsored placement (labelled)</li>
                  )}
                </ul>
                <Button
                  variant={
                    sub.data?.open?.planCode === p.code
                      ? "primary"
                      : "secondary"
                  }
                  busy={busy === p.code}
                  onClick={() =>
                    void run(p.code, async () => {
                      await api(`vendors/${vendor.id}/subscriptions`, {
                        method: "POST",
                        body: json({ planCode: p.code }),
                      });
                      await sub.reload();
                    })
                  }
                >
                  {sub.data?.active?.planCode === p.code ? "Renew" : "Choose"}
                </Button>
              </article>
            ))}
          </div>
          {sub.data?.open && (
            <div className="security-card" style={{ marginTop: 18 }}>
              <h3>Pay for {sub.data.open.planCode}</h3>
              <p>{sub.data.instructions.note}</p>
              <ul>
                {sub.data.instructions.bkash && (
                  <li>bKash: {sub.data.instructions.bkash}</li>
                )}
                {sub.data.instructions.nagad && (
                  <li>Nagad: {sub.data.instructions.nagad}</li>
                )}
                {sub.data.instructions.bank && (
                  <li>Bank: {sub.data.instructions.bank}</li>
                )}
              </ul>
              {sub.data.open.status === "PENDING_REVIEW" ? (
                <p className="form-success">
                  We received your payment details and will confirm soon.
                </p>
              ) : (
                <form
                  className="form-stack"
                  onSubmit={(e) => {
                    const f = form(e);
                    const file = (
                      e.currentTarget.elements.namedItem(
                        "proof",
                      ) as HTMLInputElement
                    ).files?.[0];
                    void run(
                      "pay",
                      async () => {
                        const proof = file
                          ? await uploadFile(file, "PAYMENT_PROOF")
                          : null;
                        await api(
                          `subscriptions/${sub.data!.open!.id}/payments`,
                          {
                            method: "POST",
                            body: json({
                              method: f.get("method"),
                              reference: f.get("reference"),
                              amountMinor: Math.round(
                                Number(f.get("amount")) * 100,
                              ),
                              proofMediaId: proof?.id,
                            }),
                          },
                        );
                        await sub.reload();
                      },
                      "Payment submitted for review",
                    );
                  }}
                >
                  <div className="form-row">
                    <Field label="Paid with">
                      <select name="method">
                        <option value="BKASH">bKash</option>
                        <option value="NAGAD">Nagad</option>
                        <option value="ROCKET">Rocket</option>
                        <option value="BANK">Bank transfer</option>
                      </select>
                    </Field>
                    <Field label="Transaction ID">
                      <input name="reference" required minLength={4} />
                    </Field>
                    <Field label="Amount (৳)">
                      <input
                        name="amount"
                        type="number"
                        required
                        defaultValue={
                          (plans.data.find(
                            (p) => p.code === sub.data?.open?.planCode,
                          )?.priceMinor || 0) / 100
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Screenshot (optional)">
                    <input
                      name="proof"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                    />
                  </Field>
                  <Button busy={busy === "pay"}>Submit payment</Button>
                </form>
              )}
            </div>
          )}
          {sub.data?.history.some((s) => s.payments.length) && (
            <div className="table-scroll" style={{ marginTop: 18 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Plan</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {sub.data.history.flatMap((s) =>
                    s.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{dateLabel(p.createdAt)}</td>
                        <td>{s.planCode}</td>
                        <td>
                          {p.method} {p.reference} · {taka(p.amountMinor)}
                        </td>
                        <td>
                          <Badge value={p.status} />
                          {p.note && (
                            <small className="block muted">{p.note}</small>
                          )}
                        </td>
                        <td>
                          {p.receiptNumber && (
                            <Link
                              className="text-link"
                              href={`/receipts/${p.id}`}
                              target="_blank"
                            >
                              <Receipt size={14} /> {p.receiptNumber}
                            </Link>
                          )}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : tab === "verification" ? (
        <section className="card padded">
          <CardHeading
            title={verification.data?.verifiedAt ? "Verified" : "Get verified"}
            subtitle={
              verification.data?.verifiedAt
                ? `Verified on ${dateLabel(verification.data.verifiedAt)}. The badge shows on your profile.`
                : "Upload your trade licence or NID. Only our review team can see these files."
            }
          />
          {verification.data?.verifiedAt ? (
            <p className="form-success">
              <BadgeCheck size={16} /> Verified business
            </p>
          ) : verification.data?.requests.some(
              (r) => r.status === "SUBMITTED",
            ) ? (
            <p className="form-success">Your documents are being reviewed.</p>
          ) : (
            <form
              className="form-stack"
              onSubmit={(e) => {
                const f = form(e);
                const files = Array.from(
                  (
                    e.currentTarget.elements.namedItem(
                      "docs",
                    ) as HTMLInputElement
                  ).files || [],
                );
                void run(
                  "verify",
                  async () => {
                    if (!files.length)
                      throw new Error("Choose at least one document");
                    const ids: string[] = [];
                    for (const file of files)
                      ids.push((await uploadFile(file, "VERIFICATION")).id);
                    await api(`vendors/${vendor.id}/verification`, {
                      method: "POST",
                      body: json({
                        documentType: f.get("documentType"),
                        mediaIds: ids,
                      }),
                    });
                    await verification.reload();
                  },
                  "Documents submitted",
                );
              }}
            >
              <Field label="Document">
                <select name="documentType">
                  <option value="TRADE_LICENSE">Trade licence</option>
                  <option value="NID">National ID</option>
                  <option value="TIN">TIN certificate</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Files (photo or PDF, up to 6)">
                <input
                  name="docs"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                />
              </Field>
              <Button busy={busy === "verify"}>Submit for verification</Button>
            </form>
          )}
          {verification.data?.requests
            .filter((r) => r.status === "REJECTED")
            .slice(0, 1)
            .map((r) => (
              <p key={r.id} className="form-error">
                Last review: {r.note}
              </p>
            ))}
        </section>
      ) : tab === "reviews" ? (
        <section className="card padded">
          <CardHeading
            title="Reviews"
            subtitle="Reply once to each review. Report reviews that break the rules."
          />
          {reviews.data?.items.map((r) => (
            <article
              key={r.id}
              className="side-card"
              style={{ marginBottom: 12 }}
            >
              <strong>
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)} <Badge value={r.status} />
              </strong>
              <p>{r.body}</p>
              {r.reply ? (
                <p className="muted">Your reply: {r.reply}</p>
              ) : (
                <form
                  className="security-row"
                  onSubmit={(e) => {
                    const f = form(e);
                    void run(
                      `rep-${r.id}`,
                      async () => {
                        await api(`reviews/${r.id}/reply`, {
                          method: "POST",
                          body: json({ reply: f.get("reply") }),
                        });
                        await reviews.reload();
                      },
                      "Reply posted",
                    );
                  }}
                >
                  <Field label="Reply">
                    <input
                      name="reply"
                      required
                      minLength={2}
                      maxLength={1000}
                    />
                  </Field>
                  <Button variant="secondary" busy={busy === `rep-${r.id}`}>
                    Reply
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const reason = window.prompt(
                        "Why should this review be checked? (at least 10 characters)",
                      );
                      if (reason)
                        void run(
                          "report",
                          async () => {
                            await api(`reviews/${r.id}/report`, {
                              method: "POST",
                              body: json({ reason }),
                            });
                            await reviews.reload();
                          },
                          "Reported to our team",
                        );
                    }}
                  >
                    Report
                  </Button>
                </form>
              )}
            </article>
          ))}
          {!reviews.data?.items.length && (
            <Empty title="No reviews yet">
              <Star size={14} /> Families can review you after a completed
              booking.
            </Empty>
          )}
        </section>
      ) : tab === "quote" ? (
        <section className="card padded">
          <CardHeading
            title="Send a quotation"
            subtitle="To a family that contacted you. They are notified by SMS and email."
          />
          {!clients.data.length ? (
            <p className="muted">
              You can quote once a family sends you an inquiry or message.
            </p>
          ) : (
            <form
              className="form-stack"
              onSubmit={(e) => {
                const f = form(e);
                const breakdown = lines
                  .filter((l) => l.label && l.amount)
                  .map((l) => ({
                    label: l.label,
                    amountMinor: Math.round(Number(l.amount) * 100),
                  }));
                void run(
                  "quote",
                  async () => {
                    await api("quotes", {
                      method: "POST",
                      body: json({
                        vendorId: vendor.id,
                        eventId: f.get("eventId"),
                        amountMinor: breakdown.reduce(
                          (n, l) => n + l.amountMinor,
                          0,
                        ),
                        breakdown,
                        expiresAt: localDateToISO(String(f.get("expiresAt"))),
                      }),
                    });
                    setLines([{ label: "", amount: "" }]);
                  },
                  "Quotation sent",
                );
              }}
            >
              <Field label="Event">
                <select name="eventId" required>
                  {clients.data.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </Field>
              {lines.map((line, i) => (
                <div key={i} className="form-row">
                  <Field label={`Item ${i + 1}`}>
                    <input
                      value={line.label}
                      onChange={(e) =>
                        setLines(
                          lines.map((l, j) =>
                            j === i ? { ...l, label: e.target.value } : l,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Amount (৳)">
                    <input
                      type="number"
                      min="0"
                      value={line.amount}
                      onChange={(e) =>
                        setLines(
                          lines.map((l, j) =>
                            j === i ? { ...l, amount: e.target.value } : l,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setLines([...lines, { label: "", amount: "" }])}
              >
                <Plus size={15} /> Add a line
              </Button>
              <p>
                Total:{" "}
                <strong>
                  {taka(
                    lines.reduce(
                      (n, l) => n + Math.round(Number(l.amount || 0) * 100),
                      0,
                    ),
                  )}
                </strong>
              </p>
              <Field label="Valid until">
                <input name="expiresAt" type="datetime-local" required />
              </Field>
              <Button busy={busy === "quote"}>Send quotation</Button>
            </form>
          )}
        </section>
      ) : (
        <section className="card padded">
          <CardHeading
            title="Block dates"
            subtitle="Days you are unavailable. Families will not be able to book them."
          />
          <form
            className="form-stack"
            onSubmit={(e) => {
              const f = form(e);
              void run(
                "block",
                () =>
                  api(`vendors/${vendor.id}/blocks`, {
                    method: "POST",
                    body: json({
                      serviceId: f.get("serviceId"),
                      startAt: localDateToISO(String(f.get("startAt"))),
                      endAt: localDateToISO(String(f.get("endAt"))),
                      reason: f.get("reason") || undefined,
                    }),
                  }),
                "Dates blocked",
              );
            }}
          >
            <Field label="Service">
              <select name="serviceId">
                {vendor.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-row">
              <Field label="From">
                <input name="startAt" type="datetime-local" required />
              </Field>
              <Field label="To">
                <input name="endAt" type="datetime-local" required />
              </Field>
            </div>
            <Field label="Reason (private)">
              <input name="reason" maxLength={200} />
            </Field>
            <Button busy={busy === "block"}>Block</Button>
            <Link className="text-link" href="/availability">
              Open the full calendar
            </Link>
          </form>
        </section>
      )}
      {service && vendor && (
        <Modal
          title={service === "new" ? "Add a service" : `Edit ${service.title}`}
          onClose={() => setService(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              const f = form(e);
              const body = {
                title: f.get("title"),
                description: f.get("description") || undefined,
                basePriceMinor: Math.round(Number(f.get("price")) * 100),
                durationHours: Number(f.get("duration")),
                bufferHours: Number(f.get("buffer")),
                capacity: f.get("capacity")
                  ? Number(f.get("capacity"))
                  : undefined,
              };
              void run(
                "service",
                async () => {
                  if (service === "new")
                    await api(`vendors/${vendor.id}/services`, {
                      method: "POST",
                      body: json(body),
                    });
                  else
                    await api(`vendors/${vendor.id}/services/${service.id}`, {
                      method: "PATCH",
                      body: json(body),
                    });
                  await mine.reload();
                  setService(null);
                },
                "Service saved",
              );
            }}
          >
            {(() => {
              const s = service === "new" ? null : service;
              return (
                <>
                  <Field label="Service name">
                    <input
                      name="title"
                      required
                      minLength={2}
                      defaultValue={s?.title}
                    />
                  </Field>
                  <Field label="Description">
                    <textarea
                      name="description"
                      maxLength={1000}
                      defaultValue={s?.description || ""}
                    />
                  </Field>
                  <div className="form-row">
                    <Field label="Price (৳)">
                      <input
                        name="price"
                        type="number"
                        min="1"
                        required
                        defaultValue={s ? s.basePriceMinor / 100 : ""}
                      />
                    </Field>
                    <Field label="Guest capacity">
                      <input
                        name="capacity"
                        type="number"
                        min="1"
                        defaultValue={s?.capacity || ""}
                      />
                    </Field>
                  </div>
                  <div className="form-row">
                    <Field label="Duration (hours)">
                      <input
                        name="duration"
                        type="number"
                        min="1"
                        max="72"
                        required
                        defaultValue={s?.durationHours ?? 4}
                      />
                    </Field>
                    <Field label="Buffer after (hours)">
                      <input
                        name="buffer"
                        type="number"
                        min="0"
                        max="24"
                        required
                        defaultValue={s?.bufferHours ?? 1}
                      />
                    </Field>
                  </div>
                </>
              );
            })()}
            <Button busy={busy === "service"}>Save service</Button>
          </form>
        </Modal>
      )}
    </>
  );
}

export default function Studio() {
  return (
    <Suspense>
      <StudioPage />
    </Suspense>
  );
}
