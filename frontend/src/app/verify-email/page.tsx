"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, json } from "@/lib/api";
import { AccountFlow } from "@/components/account-flow";

function Verify() {
  const token = useSearchParams().get("token") || "";
  const [state, setState] = useState<"working" | "done" | "error">("working"),
    [error, setError] = useState("");
  useEffect(() => {
    if (!token) {
      setState("error");
      setError("This verification link is incomplete.");
      return;
    }
    api("auth/email/verify", { method: "POST", body: json({ token }) })
      .then(() => setState("done"))
      .catch((e: Error) => {
        setState("error");
        setError(e.message);
      });
  }, [token]);
  if (state === "working") return <p role="status">Confirming your email…</p>;
  if (state === "done")
    return (
      <p className="form-success" role="status">
        Your email is confirmed.{" "}
        <Link href="/dashboard">Continue to your workspace</Link>.
      </p>
    );
  return (
    <p className="form-error" role="alert">
      {error} You can request a new link from{" "}
      <Link href="/account">Account & security</Link>.
    </p>
  );
}

export default function VerifyEmail() {
  return (
    <AccountFlow title="Confirm your email">
      <Suspense>
        <Verify />
      </Suspense>
    </AccountFlow>
  );
}
