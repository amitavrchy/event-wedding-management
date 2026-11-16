import { test, expect } from "@playwright/test";
import { eventTypes } from "../src/lib/event-types";

test("public landing connects occasions, FAQs and professional onboarding", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Every reason",
  );
  await page
    .getByRole("button", { name: "Anniversaries", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Plan your anniversary" }),
  ).toHaveAttribute("href", "/signup?event=ANNIVERSARY");
  await page
    .getByRole("button", { name: "Business events", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Plan your next event" }),
  ).toHaveAttribute("href", "/signup?event=CORPORATE");
  await page
    .locator("summary")
    .filter({ hasText: "Is Utsab just for weddings?" })
    .click();
  await expect(page.locator("details[open]")).toContainText("birthdays");
  await page.getByRole("link", { name: "Build your event business" }).click();
  await expect(page.getByLabel("I am planning as")).toHaveValue("VENDOR");
  const catalog = await request.get("/api/event-types").then((r) => r.json());
  expect(catalog.map((t: any) => t.type)).toEqual(
    eventTypes.map((t) => t.type),
  );
  for (const item of eventTypes) {
    const template = catalog.find((t: any) => t.type === item.type);
    expect([
      template.budgetMinor,
      template.guestCapacity,
      template.durationHours,
    ]).toEqual([item.budget * 100, item.guests, item.hours]);
  }
  expect(errors).toEqual([]);
});

test("landing stays readable across desktop, tablet and mobile; mobile sign-in works", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const small = await page
      .locator(".landing")
      .first()
      .evaluate((root) =>
        [...root.querySelectorAll("*")]
          .filter(
            (el) =>
              el.textContent?.trim() &&
              el.getClientRects().length &&
              parseFloat(getComputedStyle(el).fontSize) < 14,
          )
          .map((el) => `${el.tagName}: ${getComputedStyle(el).fontSize}`),
      );
    expect(small).toEqual([]);
  }
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Sign in", exact: true })
    .click();
  await expect(page).toHaveURL("/login");
  await expect(page.getByLabel("Email address")).toBeVisible();
});

test("birthday landing intent survives sign-in and creates a complete editable plan", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Plan your birthday" }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email address").fill("host@utsab.local");
  await page.getByLabel("Password", { exact: true }).fill("UtsabDemo2027!");
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Occasion type")).toHaveValue("BIRTHDAY");
  await expect(dialog.getByLabel("Total budget")).toHaveValue("100000");
  await dialog.getByLabel("Occasion type").selectOption("CORPORATE");
  await expect(dialog.getByLabel("Guest capacity")).toHaveValue("150");
  await dialog.getByLabel("Occasion type").selectOption("BIRTHDAY");
  const title = `Birthday browser ${Date.now()}`;
  await dialog.getByLabel("Event name").fill(title);
  await dialog
    .getByText("Already have a date? Add your event schedule")
    .click();
  await dialog
    .getByLabel("Event date (optional)")
    .fill(new Date(Date.now() + 150 * 86400000).toISOString().slice(0, 10));
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/events") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Create event workspace" }).click();
  const response = await created,
    event = await response.json();
  expect(response.status()).toBe(201);
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  expect(event.eventType).toBe("BIRTHDAY");
  expect(
    event.budget.reduce((s: number, b: any) => s + b.plannedMinor, 0),
  ).toBe(10000000);
  expect(event.days).toHaveLength(1);
  await page.goto("/budget");
  await expect(
    page.getByText("Cake & desserts", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/checklist");
  await expect(
    page.getByText("Choose the cake and dessert table", { exact: true }),
  ).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByLabel("Occasion type")).toHaveValue("BIRTHDAY");
  // Leave this plan available for manual review in the host demo account.
});
