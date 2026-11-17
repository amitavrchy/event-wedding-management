"use client";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { MonitorSmartphone, ShieldCheck, Trash2 } from "lucide-react";
import "@/app/account.css";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import type { User } from "@/lib/types";
import { Badge, Button, Field, PageHeading } from "@/components/ui";

type Session = {
  id: string;
  client: string;
  deviceName?: string | null;
  userAgent?: string | null;
  lastUsedAt: string;
  current: boolean;
};

function useAction() {
  const { notify } = useApp();
  const [busy, setBusy] = useState("");
  const run = useCallback(
    async (name: string, action: () => Promise<unknown>, success?: string) => {
      setBusy(name);
      try {
        await action();
        if (success) notify(success);
        return true;
      } catch (e) {
        notify((e as Error).message, true);
        return false;
      } finally {
        setBusy("");
      }
    },
    [notify],
  );
  return { busy, run };
}

const deviceLabel = (s: Session) =>
  s.deviceName ||
  (s.client === "mobile"
    ? "Ayojon app"
    : s.userAgent?.match(/(Chrome|Firefox|Safari|Edg)[/\s][\d.]+/)?.[0] ||
      "Web browser");

export default function Account() {
  const { user, setUser, logout } = useApp();
  const { busy, run } = useAction();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [phoneSent, setPhoneSent] = useState("");
  const [totp, setTotp] = useState<{ secret: string; qr: string } | null>(null);

  const loadSessions = useCallback(
    () => api<Session[]>("auth/sessions").then(setSessions),
    [],
  );
  useEffect(() => {
    void loadSessions().catch(() => undefined);
    void api<User>("auth/me")
      .then(setUser)
      .catch(() => undefined);
  }, [loadSessions, setUser]);

  if (!user) return null;
  const form = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return new FormData(e.currentTarget);
  };

  return (
    <>
      <PageHeading
        eyebrow="YOUR ACCOUNT"
        title="Account & security"
        description="Your details, sign-in protection and the devices signed in to your account."
      />
      <div className="security-grid">
        <section className="security-card">
          <h2>Profile</h2>
          <p>
            Your name appears to collaborators and vendors. Language sets the
            language of emails and SMS.
          </p>
          <form
            className="security-row"
            onSubmit={(e) => {
              const f = form(e);
              void run(
                "profile",
                async () =>
                  setUser(
                    await api<User>("auth/me", {
                      method: "PATCH",
                      body: json({
                        fullName: f.get("fullName"),
                        locale: f.get("locale"),
                      }),
                    }),
                  ),
                "Profile saved",
              );
            }}
          >
            <Field label="Full name">
              <input
                name="fullName"
                defaultValue={user.fullName}
                required
                minLength={2}
              />
            </Field>
            <Field label="Language">
              <select name="locale" defaultValue={user.locale || "en"}>
                <option value="en">English</option>
                <option value="bn">বাংলা</option>
              </select>
            </Field>
            <Button busy={busy === "profile"} type="submit">
              Save
            </Button>
          </form>
        </section>

        <section className="security-card">
          <h2>
            Email{" "}
            {user.emailVerified ? (
              <Badge value="ACTIVE" />
            ) : (
              <Badge value="PENDING" />
            )}
          </h2>
          <p>
            {user.email}.{" "}
            {user.emailVerified
              ? "Verified. Password reset links and booking updates go here."
              : "Enter the 6-digit code we emailed you, or open the link in that email."}
          </p>
          {!user.emailVerified && (
            <form
              className="security-row"
              onSubmit={(e) => {
                const f = form(e);
                void run(
                  "email",
                  async () =>
                    setUser(
                      await api<User>("auth/email/verify", {
                        method: "POST",
                        body: json({ code: f.get("code") }),
                      }),
                    ),
                  "Email confirmed",
                );
              }}
            >
              <Field label="Verification code">
                <input
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                />
              </Field>
              <Button busy={busy === "email"} type="submit">
                Confirm
              </Button>
              <Button
                type="button"
                variant="ghost"
                busy={busy === "resend"}
                onClick={() =>
                  void run(
                    "resend",
                    () =>
                      api("auth/email/resend", { method: "POST", body: "{}" }),
                    "A new code is on its way",
                  )
                }
              >
                Send a new code
              </Button>
            </form>
          )}
        </section>

        <section className="security-card">
          <h2>
            Mobile number {user.phoneVerified ? <Badge value="ACTIVE" /> : null}
          </h2>
          <p>
            {user.phone && user.phoneVerified
              ? `${user.phone}. Verified for SMS updates.`
              : "Add a Bangladeshi mobile number to get booking and RSVP updates by SMS."}
          </p>
          {!phoneSent ? (
            <form
              className="security-row"
              onSubmit={(e) => {
                const f = form(e);
                void run("phone", async () => {
                  const result = await api<{ phone: string }>(
                    "auth/phone/start",
                    {
                      method: "POST",
                      body: json({ phone: f.get("phone") }),
                    },
                  );
                  setPhoneSent(result.phone);
                });
              }}
            >
              <Field label="Mobile number">
                <input
                  name="phone"
                  type="tel"
                  required
                  placeholder="01XXXXXXXXX"
                  defaultValue={user.phone || ""}
                  autoComplete="tel"
                />
              </Field>
              <Button busy={busy === "phone"} type="submit">
                Send code
              </Button>
            </form>
          ) : (
            <form
              className="security-row"
              onSubmit={(e) => {
                const f = form(e);
                void run(
                  "phone-verify",
                  async () => {
                    setUser(
                      await api<User>("auth/phone/verify", {
                        method: "POST",
                        body: json({ code: f.get("code") }),
                      }),
                    );
                    setPhoneSent("");
                  },
                  "Mobile number verified",
                );
              }}
            >
              <Field label={`Code sent to ${phoneSent}`}>
                <input
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                />
              </Field>
              <Button busy={busy === "phone-verify"} type="submit">
                Verify
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPhoneSent("")}
              >
                Change number
              </Button>
            </form>
          )}
        </section>

        <section className="security-card">
          <h2>Password</h2>
          <p>Changing your password signs out every other device.</p>
          <form
            className="security-row"
            onSubmit={(e) => {
              const f = form(e);
              const target = e.currentTarget;
              void run(
                "password",
                async () => {
                  await api("auth/password/change", {
                    method: "POST",
                    body: json({
                      currentPassword: f.get("currentPassword"),
                      newPassword: f.get("newPassword"),
                    }),
                  });
                  target.reset();
                  await loadSessions();
                },
                "Password changed",
              );
            }}
          >
            <Field label="Current password">
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </Field>
            <Field label="New password">
              <input
                name="newPassword"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
              />
            </Field>
            <Button busy={busy === "password"} type="submit">
              Change password
            </Button>
          </form>
        </section>

        <section className="security-card">
          <h2>
            <ShieldCheck size={18} /> Two-step sign-in{" "}
            {user.twoFactorEnabled ? <Badge value="ACTIVE" /> : null}
          </h2>
          <p>
            {user.twoFactorEnabled
              ? "On. Signing in asks for a code from your authenticator app."
              : "Protect your account with a code from Google Authenticator, Microsoft Authenticator or a similar app."}
          </p>
          {user.twoFactorEnabled ? (
            <form
              className="security-row"
              onSubmit={(e) => {
                const f = form(e);
                void run(
                  "2fa-off",
                  async () =>
                    setUser(
                      await api<User>("auth/2fa/disable", {
                        method: "POST",
                        body: json({
                          password: f.get("password"),
                          code: f.get("code"),
                        }),
                      }),
                    ),
                  "Two-step sign-in is off",
                );
              }}
            >
              <Field label="Password">
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Field label="Current code">
                <input
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                />
              </Field>
              <Button
                variant="secondary"
                busy={busy === "2fa-off"}
                type="submit"
              >
                Turn off
              </Button>
            </form>
          ) : totp ? (
            <div className="totp-setup">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={totp.qr} alt="QR code for your authenticator app" />
              <form
                className="form-stack"
                onSubmit={(e) => {
                  const f = form(e);
                  void run(
                    "2fa-on",
                    async () => {
                      setUser(
                        await api<User>("auth/2fa/enable", {
                          method: "POST",
                          body: json({ code: f.get("code") }),
                        }),
                      );
                      setTotp(null);
                      await loadSessions();
                    },
                    "Two-step sign-in is on",
                  );
                }}
              >
                <p>
                  Scan the code, or enter this key manually:{" "}
                  <code>{totp.secret}</code>
                </p>
                <Field label="Code from the app">
                  <input
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    autoFocus
                  />
                </Field>
                <Button busy={busy === "2fa-on"} type="submit">
                  Turn on
                </Button>
              </form>
            </div>
          ) : (
            <Button
              busy={busy === "2fa-setup"}
              onClick={() =>
                void run("2fa-setup", async () => {
                  const setup = await api<{
                    secret: string;
                    otpauthUrl: string;
                  }>("auth/2fa/setup", { method: "POST", body: "{}" });
                  setTotp({
                    secret: setup.secret,
                    qr: await QRCode.toDataURL(setup.otpauthUrl, {
                      margin: 1,
                      width: 360,
                    }),
                  });
                })
              }
            >
              Set up two-step sign-in
            </Button>
          )}
        </section>

        <section className="security-card">
          <h2>
            <MonitorSmartphone size={18} /> Signed-in devices
          </h2>
          <p>
            End a session you do not recognise. It stops working within a
            minute.
          </p>
          <ul className="session-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>
                    {deviceLabel(s)} {s.current && <Badge value="ACTIVE" />}
                  </strong>
                  <small>
                    Last active{" "}
                    {new Date(s.lastUsedAt).toLocaleString("en-GB", {
                      timeZone: "Asia/Dhaka",
                    })}
                  </small>
                </div>
                {!s.current && (
                  <Button
                    variant="ghost"
                    busy={busy === s.id}
                    onClick={() =>
                      void run(
                        s.id,
                        async () => {
                          await api(`auth/sessions/${s.id}`, {
                            method: "DELETE",
                          });
                          await loadSessions();
                        },
                        "Session ended",
                      )
                    }
                  >
                    End
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            busy={busy === "all"}
            onClick={() =>
              void run("all", async () => {
                await api("auth/logout-all", { method: "POST", body: "{}" });
                await logout();
              })
            }
          >
            Sign out everywhere
          </Button>
        </section>

        <section className="security-card danger-zone">
          <h2>
            <Trash2 size={18} /> Delete account
          </h2>
          <p>
            Removes your name, email, phone and sign-in. Your events are
            archived and any business listing is taken down. This cannot be
            undone.
          </p>
          <form
            className="security-row"
            onSubmit={(e) => {
              const f = form(e);
              if (
                !window.confirm(
                  "Delete your account permanently? This cannot be undone.",
                )
              )
                return;
              void run("delete", async () => {
                await api("auth/me", {
                  method: "DELETE",
                  body: json({ password: f.get("password") }),
                });
                await logout();
              });
            }}
          >
            <Field label="Confirm with your password">
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </Field>
            <Button variant="secondary" busy={busy === "delete"} type="submit">
              Delete my account
            </Button>
          </form>
        </section>
      </div>
    </>
  );
}
