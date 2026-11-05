import { test, expect, Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("host@utsab.local");
  await page.getByLabel("Password", { exact: true }).fill("UtsabDemo2027!");
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Ayesha" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Choose event" })
    .selectOption("event-ayesha-raihan");
  await expect(
    page.getByRole("heading", { name: "Ayesha & Raihan", exact: true }),
  ).toBeVisible();
}
test("collection checkout reserves discounted services in one transaction", async ({
  page,
}) => {
  await login(page);
  await page.goto("/packages");
  await page
    .getByRole("button", { name: "Explore the collection" })
    .first()
    .click();
  const start = new Date(
    Date.now() + 86400000 * (350 + Math.floor(Math.random() * 300)),
  )
    .toISOString()
    .slice(0, 16);
  await page.getByLabel("Date and start time for all services").fill(start);
  await page.getByRole("button", { name: "Hold the whole collection" }).click();
  await expect(page).toHaveURL("/bookings");
  await expect(page.getByRole("status")).toContainText(
    "Your whole collection is held",
  );
  await expect(
    page
      .locator(".booking-card")
      .filter({ has: page.locator(".badge", { hasText: "held" }) }),
  ).not.toHaveCount(0);
});
test("vendor studio creates a quote that the host can accept; admin ledger is accessible", async ({
  page,
  browser,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("vendor@utsab.local");
  await page.getByLabel("Password", { exact: true }).fill("UtsabDemo2027!");
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await page.getByRole("link", { name: "Vendor studio", exact: true }).click();
  await page.getByRole("button", { name: "Send a quote", exact: true }).click();
  await page
    .getByLabel("Your business")
    .selectOption({ label: "The Grand Palace · active" });
  await page
    .getByLabel("Client celebration")
    .selectOption({ label: "Ayesha & Raihan" });
  await page
    .getByLabel("Quote description")
    .fill("Personalized ceremony flowers");
  await page.getByLabel("Total amount").fill("50000");
  await page.getByLabel("Valid until").fill("2027-12-01T18:00");
  await page.getByRole("button", { name: "Save quote" }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  const ctx = await browser.newContext();
  const host = await ctx.newPage();
  await login(host);
  await host.goto("/packages");
  await host
    .locator(".quote-row")
    .last()
    .getByRole("button", { name: "Accept", exact: true })
    .click();
  await expect(host.locator(".quote-row").last()).toContainText("accepted");
  await ctx.close();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Email address").fill("admin@utsab.local");
  await page.getByLabel("Password", { exact: true }).fill("UtsabDemo2027!");
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await page.getByRole("link", { name: "Administration", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Platform administration" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Vendor payout ledger" }),
  ).toBeVisible();
});
test("two signed-in sessions exchange a message in real time", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/messages");
  await page.getByRole("button", { name: "New conversation" }).click();
  await page
    .getByRole("button", { name: "Start conversation", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Your message" }),
  ).toBeVisible();
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await login(other);
  await other.goto("/messages");
  await other.locator(".conversation").first().click();
  const text = `A lovely hello ${Date.now()}`;
  await page.getByRole("textbox", { name: "Your message" }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(other.getByText(text, { exact: true })).toBeVisible({
    timeout: 4500,
  });
  await expect(page.getByText(text, { exact: true })).toHaveCount(1);
  await ctx.close();
});
test("desktop dashboard and every workspace route are usable with 14px minimum text", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.screenshot({
    path: "artifacts/dashboard-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const [path, heading] of [
    ["/vendors", "Find your dream team"],
    ["/budget", "Your budget, beautifully balanced"],
    ["/guests", "Your favorite people"],
    ["/checklist", "A little closer to your big day"],
    ["/timeline", "The moments that make your story"],
    ["/packages", "A little more, together"],
    ["/messages", "A little hello goes a long way"],
    ["/settings", "Make it yours"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    const small = await page.locator("body").evaluate((body) =>
      Array.from(body.querySelectorAll("*"))
        .filter(
          (e) =>
            e.textContent?.trim() &&
            e.getClientRects().length &&
            parseFloat(getComputedStyle(e).fontSize) < 14,
        )
        .map((e) => ({
          tag: e.tagName,
          text: e.textContent?.slice(0, 30),
          size: getComputedStyle(e).fontSize,
        })),
    );
    expect(small).toEqual([]);
  }
  expect(errors).toEqual([]);
});
test("guest invitation works publicly and RSVP updates the host list", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/guests");
  await page.getByRole("button", { name: "Add a guest", exact: true }).click();
  await page.getByLabel("Guest name").fill(`Browser Guest ${Date.now()}`);
  await page.getByLabel("Email (optional)").fill("browser@example.com");
  await page.getByRole("button", { name: "Save guest" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const row = page
    .getByRole("row")
    .filter({ hasText: "browser@example.com" })
    .last();
  const href = await row
    .getByRole("link", { name: "Open ↗" })
    .getAttribute("href");
  const context = await browser.newContext();
  const guest = await context.newPage();
  await guest.goto(href!);
  await expect(
    guest.getByRole("heading", { name: "Ayesha & Raihan", exact: true }),
  ).toBeVisible();
  await guest.getByRole("button", { name: "Send with love" }).click();
  await expect(
    guest.getByRole("heading", { name: "Your reply means the world." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "browser@example.com" }).last(),
  ).toContainText("accepted");
  await context.close();
});
test("budget expenses and checklist tasks persist after reload", async ({
  page,
}) => {
  await login(page);
  await page.goto("/budget");
  await page.getByRole("button", { name: "Add an expense" }).click();
  const title = `Invitations ${Date.now()}`;
  await page.getByLabel("Expense description").fill(title);
  await page.getByLabel("Amount in taka").fill("1250");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("cell", { name: title })).toBeVisible();
  await page.goto("/checklist");
  await page.getByRole("button", { name: "Add a task" }).click();
  await page.getByLabel("What needs a little love?").fill(title);
  await page.getByRole("button", { name: "Add to checklist" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button").filter({ hasText: title }).click();
  await page.reload();
  await expect(page.getByRole("button").filter({ hasText: title })).toHaveClass(
    /done/,
  );
});
test("mobile navigation and layouts fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.screenshot({
    path: "artifacts/dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Find vendors", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Find your dream team" }),
  ).toBeVisible();
  await expect(page.locator(".mobile-scrim")).not.toBeVisible();
  await page.getByRole("button", { name: "Venue", exact: true }).click();
  await expect(page.locator(".vendor-card")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("vendor reservations and sandbox advance confirm a booking", async ({
  page,
}) => {
  await login(page);
  await page.goto("/vendors");
  await page.getByRole("button", { name: "Photography", exact: true }).click();
  await page.locator(".vendor-card").first().click();
  const start = new Date(
    Date.now() + 86400000 * (30 + Math.floor(Math.random() * 300)),
  )
    .toISOString()
    .slice(0, 16);
  await page.getByLabel("Celebration date & time").fill(start);
  await page.getByRole("button", { name: "Hold this date" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/bookings");
  const held = page
    .locator(".booking-card")
    .filter({ has: page.locator(".badge", { hasText: "held" }) })
    .last();
  await expect(held).toBeVisible();
  await held.getByRole("button", { name: /Test advance/ }).click();
  await expect(page.getByRole("status")).toContainText(
    "Sandbox payment recorded",
  );
  await expect(
    page
      .locator(".booking-card")
      .filter({ has: page.locator(".badge", { hasText: "confirmed" }) })
      .last(),
  ).toBeVisible();
});
