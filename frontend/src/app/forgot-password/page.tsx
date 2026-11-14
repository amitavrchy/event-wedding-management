"use client";
import Link from "next/link";
import { useState } from "react";
import { api, json } from "@/lib/api";
import { AccountFlow } from "@/components/account-flow";
import { Button, Field } from "@/components/ui";

export default function ForgotPassword() {
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState(""),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ message: string }>("auth/password/forgot", {
        method: "POST",
        body: json({ email: new FormData(e.currentTarget).get("email") }),
      });
      setSent(result.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountFlow
      title="Reset your password"
      intro="Enter the email you signed up with. We’ll send a link that works for 30 minutes."
    >
      {sent ? (
        <p className="form-success" role="status">
          {sent}
        </p>
      ) : (
        <form onSubmit={submit}>
          <Field label="Email address">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </Field>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button busy={busy} type="submit">
            Send reset link
          </Button>
        </form>
      )}
      <div className="account-flow-links">
        <Link href="/login">Back to sign in</Link>
      </div>
    </AccountFlow>
  );
}
