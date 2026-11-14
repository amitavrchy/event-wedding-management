"use client";
import { useState } from "react";
import { ArrowRight, Heart, Sparkles, Check } from "lucide-react";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { User } from "@/lib/types";
import { Button, Field } from "./ui";
export function AuthScreen({
  initialRegister = false,
  initialRole = "HOST",
}: {
  initialRegister?: boolean;
  initialRole?: "HOST" | "VENDOR";
}) {
  const { login } = useApp();
  const [register, setRegister] = useState(initialRegister),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [challenge, setChallenge] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      if (challenge) {
        const result = await api<{ user: User }>("auth/login/2fa", {
          method: "POST",
          body: json({ challenge, code: f.get("code") }),
        });
        login(result.user);
        return;
      }
      const result = await api<{
        user?: User;
        twoFactorRequired?: boolean;
        challenge?: string;
      }>(`auth/${register ? "register" : "login"}`, {
        method: "POST",
        body: json({ ...Object.fromEntries(f), client: "web" }),
      });
      if (result.twoFactorRequired && result.challenge)
        setChallenge(result.challenge);
      else if (result.user) login(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-content">
        <a className="brand" href="/">
          utsab<span>✳</span>
        </a>
        <span className="eyebrow">A LITTLE LESS PLANNING. A LOT MORE JOY.</span>
        <h1>
          Big moments.
          <br />
          <em>Beautifully together.</em>
        </h1>
        <p className="auth-intro">
          Your people, your traditions, your perfect celebration. Bring every
          detail together in one thoughtful space.
        </p>
        <div className="auth-perks">
          <span>
            <Check size={16} />
            Trusted local vendors
          </span>
          <span>
            <Check size={16} />
            Every detail in one place
          </span>
        </div>
        <form onSubmit={submit} className="auth-form">
          <h2>
            {register
              ? "Your celebration starts here"
              : "Welcome to your next chapter"}
          </h2>
          {challenge && (
            <Field label="Code from your authenticator app">
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                autoComplete="one-time-code"
                placeholder="6-digit code"
              />
            </Field>
          )}
          {!challenge && register && (
            <Field label="Full name">
              <input
                name="fullName"
                required
                minLength={2}
                autoComplete="name"
                placeholder="Your full name"
              />
            </Field>
          )}
          {!challenge && (
            <>
              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Password">
                <input
                  name="password"
                  type="password"
                  required
                  minLength={register ? 10 : 1}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={
                    register ? "At least 10 characters" : "Your password"
                  }
                />
              </Field>
            </>
          )}
          {!challenge && !register && (
            <a className="auth-forgot" href="/forgot-password">
              Forgot your password?
            </a>
          )}
          {!challenge && register && (
            <Field label="I am planning as">
              <select name="role" defaultValue={initialRole}>
                <option value="HOST">A couple or event host</option>
                <option value="VENDOR">
                  An event professional or business
                </option>
              </select>
            </Field>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button busy={busy} type="submit">
            {challenge
              ? "Verify and sign in"
              : register
                ? "Create your account"
                : "Sign in to your workspace"}
            <ArrowRight size={18} />
          </Button>
          <p className="auth-switch">
            {register ? "Already part of Utsab?" : "New beginnings?"}{" "}
            <button
              type="button"
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
        </form>
        <p className="auth-footer">
          Made with care, for celebrations in Bangladesh <Heart size={14} />
        </p>
      </section>
      <aside className="auth-image">
        <div className="image-overlay" />
        <div className="floating-note">
          <Sparkles size={22} />
          <div>
            <strong>Less overwhelm. More happy tears.</strong>
            <p>We’ll help you make room for what matters.</p>
          </div>
        </div>
        <div className="auth-image-caption">
          <span>YOUR STORY DESERVES A BEAUTIFUL BEGINNING</span>
          <h2>
            For all the moments
            <br />
            you’ll remember forever.
          </h2>
        </div>
      </aside>
    </main>
  );
}
