import { test, expect } from "@playwright/test";

test("new host chooses an occasion first and sees only that occasion's tools", async ({ page }) => {
  const email = `occasion-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Nusrat Jahan");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-long-password-1");
  await page.getByRole("button", { name: "Create your account" }).click();

  // The occasion popup opens before anything else.
  const picker = page.getByRole("dialog", { name: "What are you planning?" });
  await expect(picker).toBeVisible();
  await picker.getByRole("listitem", { name: "Plan a Birthday" }).click();
  await page.getByLabel("Event name").fill("Riya's 30th");
  await page.getByRole("button", { name: "Create event workspace" }).click();

  const nav = page.getByRole("navigation", { name: "Workspace" });
  await expect(nav.getByRole("link", { name: "Gift register" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Guest list" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Bride & groom sides" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Family cost split" })).toHaveCount(0);

  // A tool outside the occasion shows a gate that can switch it on.
  await page.goto("/cost-split");
  await expect(page.getByRole("heading", { name: "Family cost split isn’t part of this event" })).toBeVisible();
  await page.getByRole("button", { name: "Add Family cost split to this event" }).click();
  await expect(page.getByRole("heading", { name: "Family cost split", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Family cost split" })).toBeVisible();
});

test("a wedding shows family sides and the gift register in Bangla-ready pages", async ({ page }) => {
  await page.request.post("/api/auth/login", { data: { email: "host@utsab.local", password: "UtsabDemo2027!", client: "web" } });
  await page.goto("/dashboard");
  await page.getByRole("combobox", { name: "Choose event" }).selectOption("event-ayesha-raihan");
  const nav = page.getByRole("navigation", { name: "Workspace" });
  await expect(nav.getByRole("link", { name: "Bride & groom sides" })).toBeVisible();
  await nav.getByRole("link", { name: "Gift register" }).click();
  await page.getByRole("button", { name: "Record a gift" }).click();
  const name = `Nasrin Khala ${Date.now()}`;
  const dialog = page.getByRole("dialog", { name: "Record a gift" });
  await dialog.getByLabel("From", { exact: true }).fill(name);
  await dialog.getByLabel("Amount or value (৳)").fill("5000");
  await dialog.getByRole("button", { name: "Save gift" }).click();
  await expect(page.getByRole("status")).toContainText("Gift recorded");
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
});
