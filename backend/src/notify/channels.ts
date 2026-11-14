import { createSign } from "node:crypto";
import { Logger } from "@nestjs/common";
import { isProduction } from "../config";

/**
 * Delivery adapters. Each one is selected by environment variables so the
 * same code runs locally (console driver) and in production (real provider).
 *
 * EMAIL_DRIVER = smtp | console   (SMTP_URL, EMAIL_FROM)
 * SMS_DRIVER   = http | console   (SMS_API_URL, SMS_API_KEY, SMS_SENDER_ID)
 * PUSH_DRIVER  = fcm  | console   (FCM_SERVICE_ACCOUNT = base64 JSON)
 */
const logger = new Logger("Delivery");

export class PermanentDeliveryError extends Error {}

export type EmailMessage = { to: string; subject: string; text: string; html?: string };
export type PushMessage = { token: string; title: string; body: string; data?: Record<string, string> };

/** Messages captured by the console driver; tests read the latest codes from here. */
export const consoleOutbox: { channel: string; to: string; body: string }[] = [];
function capture(channel: string, to: string, body: string) {
  consoleOutbox.push({ channel, to, body });
  if (consoleOutbox.length > 200) consoleOutbox.shift();
  if (process.env.NODE_ENV !== "test") logger.log(`[${channel} → ${to}] ${body}`);
}

const driver = (name: string, fallback = "console") => {
  const value = (process.env[name] || fallback).toLowerCase();
  return value;
};

export function channelConfigured(channel: "EMAIL" | "SMS" | "PUSH") {
  const value = driver(`${channel}_DRIVER`);
  if (value !== "console") return true;
  // The console driver is a development convenience only.
  return !isProduction();
}

let transport: { sendMail(message: object): Promise<unknown> } | undefined;
export async function sendEmail(message: EmailMessage) {
  if (driver("EMAIL_DRIVER") !== "smtp") {
    capture("EMAIL", message.to, `${message.subject}\n${message.text}`);
    return;
  }
  if (!transport) {
    const nodemailer = await import("nodemailer");
    transport = nodemailer.createTransport(process.env.SMTP_URL);
  }
  await transport.sendMail({
    from: process.env.EMAIL_FROM || "Ayojon <no-reply@localhost>",
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

/**
 * Generic HTTP SMS gateway (the form most Bangladeshi bulk-SMS providers use):
 * POST SMS_API_URL with api_key, senderid, number, message.
 */
export async function sendSms(to: string, body: string) {
  if (driver("SMS_DRIVER") !== "http") {
    capture("SMS", to, body);
    return;
  }
  const form = new URLSearchParams({
    api_key: process.env.SMS_API_KEY || "",
    senderid: process.env.SMS_SENDER_ID || "",
    number: to.replace(/^\+/, ""),
    message: body,
  });
  const response = await fetch(process.env.SMS_API_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`SMS gateway HTTP ${response.status}`);
}

let fcmToken: { value: string; expiresAt: number } | undefined;
function serviceAccount() {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) throw new PermanentDeliveryError("FCM_SERVICE_ACCOUNT is not set");
  return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as {
    client_email: string;
    private_key: string;
    project_id: string;
  };
}
async function fcmAccessToken() {
  if (fcmToken && fcmToken.expiresAt > Date.now() + 60000) return fcmToken.value;
  const account = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key, "base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`FCM auth HTTP ${response.status}`);
  const data = (await response.json()) as { access_token: string; expires_in: number };
  fcmToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return fcmToken.value;
}

/** Returns false when the device token is no longer valid and should be removed. */
export async function sendPush(message: PushMessage): Promise<boolean> {
  if (driver("PUSH_DRIVER") !== "fcm") {
    capture("PUSH", message.token, `${message.title}: ${message.body}`);
    return true;
  }
  const account = serviceAccount();
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await fcmAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: message.token,
          notification: { title: message.title, body: message.body },
          data: message.data,
          android: { priority: "high" },
          apns: { payload: { aps: { sound: "default" } } },
        },
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (response.status === 404 || response.status === 400) {
    const text = await response.text();
    if (/UNREGISTERED|INVALID_ARGUMENT/.test(text)) return false;
    throw new Error(`FCM HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  if (!response.ok) throw new Error(`FCM HTTP ${response.status}`);
  return true;
}
