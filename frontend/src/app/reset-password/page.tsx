"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, json } from "@/lib/api";
import { AccountFlow } from "@/components/account-flow";
import { Button, Field } from "@/components/ui";

function ResetForm() {
  const token = useSearchParams().get("token") || "";
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) {
      setError("The two passwords do not match");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("auth/password/reset", {
        method: "POST",
        body: json({ token, password: f.get("password") }),
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!token)
    return (
      <p className="form-error" role="alert">
        This reset link is incomplete.{" "}
        <Link href="/forgot-password">Request a new one</Link>.
      </p>
    );
  if (done)
    return (
      <p className="form-success" role="status">
        Your password has been changed and every device was signed out.{" "}
        <Link href="/login">Sign in</Link> with your new password.
      </p>
    );
  return (
    <form onSubmit={submit}>
      <Field label="New password">
        <input
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          placeholder="At least 10 characters"
        />
      </Field>
      <Field label="Confirm new password">
        <input
          name="confirm"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button busy={busy} type="submit">
        Save new password
      </Button>
    </form>
  );
}

export default function ResetPassword() {
  return (
    <AccountFlow title="Choose a new password">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AccountFlow>
  );
}
