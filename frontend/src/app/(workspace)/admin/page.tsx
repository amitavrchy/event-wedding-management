"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Search } from "lucide-react";
import "@/app/tools.css";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { Paged, Vendor } from "@/lib/types";
import { dateLabel, taka } from "@/lib/format";
import { CategoryManager } from "@/components/category-manager";
import {
  Badge,
  Button,
  CardHeading,
  Empty,
  Field,
  PageHeading,
} from "@/components/ui";

type SubPayment = {
  id: string;
  method: string;
  reference: string;
  amountMinor: number;
  proofMediaId?: string | null;
  createdAt: string;
  subscription: { planCode: string };
  vendor?: { businessName: string; city: string };
};
type VerificationItem = {
  id: string;
  documentType: string;
  mediaIds: string[];
  createdAt: string;
  vendor?: { businessName: string; category: string; phone?: string };
};
type ReviewItem = {
  id: string;
  rating: number;
  body: string;
  reportReason?: string;
  vendorId: string;
};
type Dispute = {
  id: string;
  bookingId: string;
  reason: string;
  status: string;
};
type Ledger = {
  id: string;
  vendorId: string;
  grossMinor: number;
  commissionMinor: number;
  netMinor: number;
  status: string;
};
type AuditItem = {
  id: string;
  createdAt: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
};
type UserItem = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  emailVerifiedAt?: string;
  deletedAt?: string;
  createdAt: string;
};
type Plan = {
  code: string;
  name: string;
  priceMinor: number;
  periodDays: number;
  active: boolean;
  sortOrder: number;
  entitlements: {
    maxPhotos: number;
    maxServices: number;
    featured: boolean;
    priority: number;
  };
};

const TABS = [
  ["vendors", "Vendors"],
  ["payments", "Plan payments"],
  ["verification", "Verification"],
  ["reviews", "Reported reviews"],
  ["disputes", "Disputes"],
  ["plans", "Plans"],
  ["users", "Users"],
  ["audit", "Audit log"],
  ["categories", "Categories"],
  ["ledger", "Ledger"],
] as const;

function Pager({
  data,
  page,
  setPage,
}: {
  data: { pages: number } | null;
  page: number;
  setPage: (n: number) => void;
}) {
  if (!data || data.pages <= 1) return null;
  return (
    <nav className="pager">
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </Button>
      <span>
        {page} / {data.pages}
      </span>
      <Button
        variant="secondary"
        disabled={page >= data.pages}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}

function AdminPage() {
  const { user, notify } = useApp();
  const router = useRouter();
  const tab = useSearchParams().get("tab") || "vendors";
  const [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState("");
  const admin = user?.role === "PLATFORM_ADMIN";
  const on = (key: string, path: string) =>
    admin && tab === key ? path : null;
  const vendors = useResource<Paged<Vendor> | null>(
    on(
      "vendors",
      `admin/vendors?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${status}` : ""}`,
    ),
    null,
  );
  const payments = useResource<Paged<SubPayment> | null>(
    on("payments", `admin/subscription-payments?page=${page}`),
    null,
  );
  const verifications = useResource<Paged<VerificationItem> | null>(
    on("verification", `admin/verifications?page=${page}`),
    null,
  );
  const reviews = useResource<Paged<ReviewItem> | null>(
    on("reviews", `reviews/admin/reported?page=${page}`),
    null,
  );
  const disputes = useResource<Dispute[]>(on("disputes", "disputes"), []);
  const ledger = useResource<Ledger[]>(on("ledger", "admin/ledger"), []);
  const audit = useResource<Paged<AuditItem> | null>(
    on("audit", `admin/audit-log?page=${page}`),
    null,
  );
  const users = useResource<Paged<UserItem> | null>(
    on(
      "users",
      `admin/users?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
    ),
    null,
  );
  const plans = useResource<Plan[]>(on("plans", "admin/plans"), []);
  if (!admin) return <Empty title="Administrator access required" />;
  async function act(
    key: string,
    path: string,
    method: string,
    body?: unknown,
    reload?: () => Promise<void>,
  ) {
    setBusy(key);
    try {
      await api(path, { method, body: body === undefined ? "{}" : json(body) });
      await reload?.();
      notify("Done");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  const openFile = async (id: string) => {
    try {
      const { url } = await api<{ url: string }>(`uploads/${id}/url`);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="PLATFORM"
        title="Administration"
        description="Listings, payments, trust and safety. Every action is recorded in the audit log."
      />
      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "selected" : ""}
            onClick={() => {
              setPage(1);
              router.replace(`/admin?tab=${key}`);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "vendors" && (
        <section className="card table-card">
          <div className="filter-bar padded">
            <div className="search-field">
              <Search size={17} />
              <input
                aria-label="Search vendors"
                value={q}
                placeholder="Business name or address"
                onChange={(e) => (setQ(e.target.value), setPage(1))}
              />
            </div>
            <select
              aria-label="Status"
              value={status}
              onChange={(e) => (setStatus(e.target.value), setPage(1))}
            >
              <option value="">All statuses</option>
              <option value="APPLIED">Applied</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Status</th>
                  <th>Plan</th>
                  <th>Verified</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {vendors.data?.items.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.businessName}</strong>
                      <small className="block muted">
                        {v.category} · {v.city}
                      </small>
                    </td>
                    <td>
                      <Badge value={v.status || "APPLIED"} />
                    </td>
                    <td>{v.planCode || "Free"}</td>
                    <td>{v.verifiedAt ? dateLabel(v.verifiedAt) : "—"}</td>
                    <td className="row-actions">
                      {v.status !== "ACTIVE" && (
                        <Button
                          variant="secondary"
                          busy={busy === `a-${v.id}`}
                          onClick={() =>
                            void act(
                              `a-${v.id}`,
                              `admin/vendors/${v.id}`,
                              "PATCH",
                              { status: "ACTIVE" },
                              vendors.reload,
                            )
                          }
                        >
                          Activate
                        </Button>
                      )}
                      {v.status === "ACTIVE" && (
                        <Button
                          variant="ghost"
                          busy={busy === `s-${v.id}`}
                          onClick={() =>
                            window.confirm(`Suspend ${v.businessName}?`) &&
                            void act(
                              `s-${v.id}`,
                              `admin/vendors/${v.id}`,
                              "PATCH",
                              { status: "SUSPENDED" },
                              vendors.reload,
                            )
                          }
                        >
                          Suspend
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager data={vendors.data} page={page} setPage={setPage} />
        </section>
      )}

      {tab === "payments" && (
        <section className="card table-card">
          <CardHeading
            title="Payments waiting for review"
            subtitle="Check the transaction in the bKash/Nagad/bank statement before approving."
          />
          <div className="table-scroll">
            <table>
              <tbody>
                {payments.data?.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.vendor?.businessName}</strong>
                      <small className="block muted">
                        {dateLabel(p.createdAt)}
                      </small>
                    </td>
                    <td>
                      {p.subscription.planCode} · {taka(p.amountMinor)}
                    </td>
                    <td>
                      {p.method} <code>{p.reference}</code>
                      {p.proofMediaId && (
                        <button
                          className="text-link"
                          onClick={() => void openFile(p.proofMediaId!)}
                        >
                          Screenshot
                        </button>
                      )}
                    </td>
                    <td className="row-actions">
                      <Button
                        busy={busy === `ok-${p.id}`}
                        onClick={() =>
                          void act(
                            `ok-${p.id}`,
                            `admin/subscription-payments/${p.id}/approve`,
                            "POST",
                            {},
                            payments.reload,
                          )
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          const note = window.prompt(
                            "Reason shown to the vendor",
                          );
                          if (note)
                            void act(
                              `no-${p.id}`,
                              `admin/subscription-payments/${p.id}/reject`,
                              "POST",
                              { note },
                              payments.reload,
                            );
                        }}
                      >
                        Reject
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!payments.data?.items.length && <Empty title="Nothing to review" />}
          <Pager data={payments.data} page={page} setPage={setPage} />
        </section>
      )}

      {tab === "verification" && (
        <section className="card table-card">
          <div className="table-scroll">
            <table>
              <tbody>
                {verifications.data?.items.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong>{v.vendor?.businessName}</strong>
                      <small className="block muted">
                        {v.vendor?.category} · {v.vendor?.phone || "no phone"}
                      </small>
                    </td>
                    <td>
                      {v.documentType.replace("_", " ")}
                      {v.mediaIds.map((id, i) => (
                        <button
                          key={id}
                          className="text-link"
                          onClick={() => void openFile(id)}
                        >
                          File {i + 1}
                        </button>
                      ))}
                    </td>
                    <td className="row-actions">
                      <Button
                        busy={busy === `v-${v.id}`}
                        onClick={() =>
                          void act(
                            `v-${v.id}`,
                            `admin/verifications/${v.id}/approve`,
                            "POST",
                            {},
                            verifications.reload,
                          )
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          const note = window.prompt("What is missing?");
                          if (note)
                            void act(
                              `vr-${v.id}`,
                              `admin/verifications/${v.id}/reject`,
                              "POST",
                              { note },
                              verifications.reload,
                            );
                        }}
                      >
                        Reject
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!verifications.data?.items.length && (
            <Empty title="No documents waiting" />
          )}
        </section>
      )}

      {tab === "reviews" && (
        <section className="card padded">
          {reviews.data?.items.map((r) => (
            <article
              key={r.id}
              className="side-card"
              style={{ marginBottom: 12 }}
            >
              <strong>{"★".repeat(r.rating)}</strong>
              <p>{r.body}</p>
              <p className="muted">Reported: {r.reportReason}</p>
              <div className="button-group">
                <Button
                  variant="secondary"
                  onClick={() =>
                    void act(
                      `p-${r.id}`,
                      `reviews/${r.id}/moderate`,
                      "POST",
                      { status: "PUBLISHED" },
                      reviews.reload,
                    )
                  }
                >
                  Keep published
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void act(
                      `h-${r.id}`,
                      `reviews/${r.id}/moderate`,
                      "POST",
                      { status: "HIDDEN" },
                      reviews.reload,
                    )
                  }
                >
                  Hide
                </Button>
              </div>
            </article>
          ))}
          {!reviews.data?.items.length && <Empty title="No reported reviews" />}
        </section>
      )}

      {tab === "disputes" && (
        <section className="card padded">
          {disputes.data.map((d) => (
            <article
              key={d.id}
              className="side-card"
              style={{ marginBottom: 12 }}
            >
              <strong>
                Booking {d.bookingId.slice(-6)} <Badge value={d.status} />
              </strong>
              <p>{d.reason}</p>
              {d.status === "REQUESTED" && (
                <div className="button-group">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void act(
                        `r-${d.id}`,
                        `disputes/${d.id}/resolve`,
                        "POST",
                        { action: "REFUND" },
                        disputes.reload,
                      )
                    }
                  >
                    Approve refund
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void act(
                        `x-${d.id}`,
                        `disputes/${d.id}/resolve`,
                        "POST",
                        { action: "REJECT" },
                        disputes.reload,
                      )
                    }
                  >
                    Reject
                  </Button>
                </div>
              )}
            </article>
          ))}
          {!disputes.data.length && <Empty title="No disputes" />}
        </section>
      )}

      {tab === "plans" && (
        <section className="card padded">
          <CardHeading
            title="Subscription plans"
            subtitle="Prices are in taka. Changes apply to new purchases."
          />
          {[
            ...plans.data,
            {
              code: "",
              name: "",
              priceMinor: 0,
              periodDays: 30,
              active: true,
              sortOrder: plans.data.length + 1,
              entitlements: {
                maxPhotos: 20,
                maxServices: 10,
                featured: false,
                priority: 1,
              },
            },
          ].map((p) => (
            <form
              key={p.code || "new"}
              className="security-row side-card"
              style={{ marginBottom: 12 }}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const code = String(f.get("code") || p.code);
                void act(
                  `plan-${code}`,
                  `admin/plans/${code}`,
                  "PUT",
                  {
                    name: f.get("name"),
                    priceMinor: Math.round(Number(f.get("price")) * 100),
                    periodDays: Number(f.get("days")),
                    active: f.get("active") === "on",
                    sortOrder: p.sortOrder,
                    entitlements: {
                      maxPhotos: Number(f.get("photos")),
                      maxServices: Number(f.get("services")),
                      featured: f.get("featured") === "on",
                      priority: Number(f.get("priority")),
                    },
                  },
                  plans.reload,
                );
              }}
            >
              {!p.code && (
                <Field label="Code">
                  <input
                    name="code"
                    required
                    pattern="[A-Z0-9_]+"
                    placeholder="GOLD"
                  />
                </Field>
              )}
              <Field label="Name">
                <input name="name" defaultValue={p.name} required />
              </Field>
              <Field label="Price (৳)">
                <input
                  name="price"
                  type="number"
                  min="0"
                  defaultValue={p.priceMinor / 100}
                />
              </Field>
              <Field label="Days">
                <input
                  name="days"
                  type="number"
                  min="1"
                  defaultValue={p.periodDays}
                />
              </Field>
              <Field label="Photos">
                <input
                  name="photos"
                  type="number"
                  min="1"
                  defaultValue={p.entitlements.maxPhotos}
                />
              </Field>
              <Field label="Services">
                <input
                  name="services"
                  type="number"
                  min="1"
                  defaultValue={p.entitlements.maxServices}
                />
              </Field>
              <Field label="Boost">
                <input
                  name="priority"
                  type="number"
                  min="0"
                  max="10"
                  defaultValue={p.entitlements.priority}
                />
              </Field>
              <label className="check-field">
                <input
                  name="featured"
                  type="checkbox"
                  defaultChecked={p.entitlements.featured}
                />
                <span>Sponsored</span>
              </label>
              <label className="check-field">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={p.active}
                />
                <span>On sale</span>
              </label>
              <Button variant="secondary">{p.code ? "Save" : "Create"}</Button>
            </form>
          ))}
        </section>
      )}

      {tab === "users" && (
        <section className="card table-card">
          <div className="filter-bar padded">
            <div className="search-field">
              <Search size={17} />
              <input
                aria-label="Search users"
                value={q}
                placeholder="Email or name"
                onChange={(e) => (setQ(e.target.value), setPage(1))}
              />
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <tbody>
                {users.data?.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.fullName}</strong>
                      <small className="block muted">{u.email}</small>
                    </td>
                    <td>{u.role}</td>
                    <td>
                      {u.deletedAt
                        ? "Deleted"
                        : u.emailVerifiedAt
                          ? "Email verified"
                          : "Unverified"}
                    </td>
                    <td>{dateLabel(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager data={users.data} page={page} setPage={setPage} />
        </section>
      )}

      {tab === "audit" && (
        <section className="card table-card">
          <CardHeading
            title="Audit log"
            subtitle="Administrative actions, newest first."
            action={
              <a
                className="button secondary"
                href="/api/admin/audit-log.csv?days=90"
              >
                <Download size={16} /> Export CSV
              </a>
            }
          />
          <div className="table-scroll">
            <table>
              <tbody>
                {audit.data?.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {new Date(a.createdAt).toLocaleString("en-GB", {
                        timeZone: "Asia/Dhaka",
                      })}
                    </td>
                    <td>{a.action}</td>
                    <td>
                      {a.targetType} · {a.targetId.slice(-8)}
                    </td>
                    <td>{a.actorRole}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager data={audit.data} page={page} setPage={setPage} />
        </section>
      )}

      {tab === "categories" && <CategoryManager />}

      {tab === "ledger" && (
        <section className="card table-card">
          <CardHeading
            title="Vendor payout ledger"
            subtitle="Online payments (sandbox only until a gateway is live)."
          />
          <div className="table-scroll">
            <table>
              <tbody>
                {ledger.data.map((l) => (
                  <tr key={l.id}>
                    <td>{l.vendorId.slice(-6)}</td>
                    <td>{taka(l.grossMinor)}</td>
                    <td>{taka(l.commissionMinor)}</td>
                    <td>{taka(l.netMinor)}</td>
                    <td>
                      <Badge value={l.status} />
                    </td>
                    <td>
                      {l.status === "PENDING" && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            void act(
                              `l-${l.id}`,
                              `admin/ledger/${l.id}/paid`,
                              "PATCH",
                              undefined,
                              ledger.reload,
                            )
                          }
                        >
                          Mark paid
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!ledger.data.length && <Empty title="No ledger entries" />}
        </section>
      )}
    </>
  );
}

export default function Admin() {
  return (
    <Suspense>
      <AdminPage />
    </Suspense>
  );
}
