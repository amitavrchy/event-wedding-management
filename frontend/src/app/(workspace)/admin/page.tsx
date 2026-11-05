"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { Vendor } from "@/lib/types";
import { taka } from "@/lib/format";
import {
  Badge,
  Button,
  CardHeading,
  Empty,
  PageHeading,
} from "@/components/ui";
type Ledger = {
  id: string;
  vendorId: string;
  grossMinor: number;
  commissionMinor: number;
  netMinor: number;
  status: string;
};
export default function Admin() {
  const { user, notify } = useApp();
  const [vendors, setVendors] = useState<Vendor[]>([]),
    [ledger, setLedger] = useState<Ledger[]>([]),
    [busy, setBusy] = useState("");
  async function load() {
    try {
      const [v, l] = await Promise.all([
        api<Vendor[]>("admin/vendors"),
        api<Ledger[]>("admin/ledger"),
      ]);
      setVendors(v);
      setLedger(l);
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  useEffect(() => {
    if (user?.role === "PLATFORM_ADMIN") void load();
  }, [user]);
  if (user?.role !== "PLATFORM_ADMIN")
    return <Empty title="Administrator access required" />;
  async function mutate(path: string, body?: unknown) {
    setBusy(path);
    try {
      await api(path, { method: "PATCH", body: body ? json(body) : undefined });
      await load();
      notify("Administration record updated");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="CARE BEHIND EVERY CELEBRATION"
        title="Platform administration"
        description="Review businesses, manage commission rates, and reconcile vendor payouts."
      />
      <section className="card">
        <CardHeading title="Vendor applications & moderation" />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Status</th>
                <th>Commission</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td>
                    <strong>{v.businessName}</strong>
                    <small className="block muted">{v.id}</small>
                  </td>
                  <td>
                    <Badge value={v.status} />
                  </td>
                  <td>
                    <form
                      className="inline-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void mutate(`admin/vendors/${v.id}`, {
                          commissionBps: Number(f.get("bps")),
                        });
                      }}
                    >
                      <input
                        aria-label={`Commission basis points for ${v.businessName}`}
                        type="number"
                        name="bps"
                        defaultValue={v.commissionBps}
                        min="0"
                        max="5000"
                        required
                      />
                      <Button
                        variant="secondary"
                        busy={busy === `admin/vendors/${v.id}`}
                      >
                        Save
                      </Button>
                    </form>
                  </td>
                  <td>
                    <Button
                      variant="secondary"
                      busy={busy === `admin/vendors/${v.id}`}
                      onClick={() =>
                        void mutate(`admin/vendors/${v.id}`, {
                          status:
                            v.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                        })
                      }
                    >
                      {v.status === "ACTIVE" ? "Suspend" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card section-gap">
        <CardHeading
          title="Vendor payout ledger"
          subtitle="Mark paid only after settling funds outside the platform."
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Captured</th>
                <th>Commission</th>
                <th>Vendor share</th>
                <th>Status</th>
                <th>Reconcile</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((l) => (
                <tr key={l.id}>
                  <td>
                    {vendors.find((v) => v.id === l.vendorId)?.businessName ||
                      l.vendorId}
                  </td>
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
                        busy={busy === `admin/ledger/${l.id}/paid`}
                        onClick={() => void mutate(`admin/ledger/${l.id}/paid`)}
                      >
                        Mark settled
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ledger.length && (
          <Empty title="No captured payments to reconcile yet" />
        )}
      </section>
    </>
  );
}
