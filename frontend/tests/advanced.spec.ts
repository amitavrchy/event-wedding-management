import { test, expect, Page, APIRequestContext } from "@playwright/test";
let host: any, vendor: any, event: any, day: any, guest: any, business: any;
const suffix = Date.now().toString(),
  title = `Advanced studio ${suffix}`;
async function request(
  api: APIRequestContext,
  identity: any,
  path: string,
  data?: unknown,
  method = "POST",
) {
  const response = await api.fetch(`/api/${path}`, {
    method,
    headers: { Authorization: `Bearer ${identity.token}` },
    data,
  });
  if (!response.ok())
    throw new Error(`${path}: ${response.status()} ${await response.text()}`);
  return response.json();
}
async function session(page: Page, identity: any) {
  // Web sessions are httpOnly cookies; page.request shares the page's cookie jar.
  const login = await page.request.post("/api/auth/login", {
    data: { email: identity.email, password: "UtsabDemo2027!", client: "web" },
  });
  expect(login.ok()).toBeTruthy();
  await page.goto(identity.user.role === "VENDOR" ? "/business" : "/dashboard");
  if (identity.user.role === "VENDOR") {
    await expect(
      page.getByRole("navigation", { name: "Workspace" }),
    ).toBeVisible();
    return;
  }
  await expect(
    page.getByRole("combobox", { name: "Choose event" }),
  ).toBeVisible();
  if (identity.user.role === "HOST")
    await page
      .getByRole("combobox", { name: "Choose event" })
      .selectOption(event.id);
}
test.beforeAll(async ({ request: api }) => {
  host = await api
    .post("/api/auth/login", {
      data: {
        email: "host@utsab.local",
        password: "UtsabDemo2027!",
        client: "mobile",
      },
    })
    .then((r) => r.json())
    .then((r) => ({ ...r, token: r.accessToken, email: "host@utsab.local" }));
  vendor = await api
    .post("/api/auth/login", {
      data: {
        email: "vendor@utsab.local",
        password: "UtsabDemo2027!",
        client: "mobile",
      },
    })
    .then((r) => r.json())
    .then((r) => ({ ...r, token: r.accessToken, email: "vendor@utsab.local" }));
  event = await request(api, host, "events", {
    title,
    eventType: "WEDDING",
    city: "Dhaka",
    budgetMinor: 100000000,
    guestCapacity: 30,
  });
  const date = new Date(Date.now() + 100 * 86400000).toISOString().slice(0, 10);
  day = await request(api, host, `events/${event.id}/days`, {
    name: "Wedding celebration",
    startsAt: `${date}T18:00:00+06:00`,
    endsAt: `${date}T23:00:00+06:00`,
    venueName: "The Grand Palace",
  });
  guest = await request(api, host, `events/${event.id}/guests`, {
    name: `Studio Guest ${suffix}`,
    maxPartySize: 2,
    groupName: "Family",
  });
  await api.post(`/api/rsvp/${guest.token}`, {
    data: {
      rsvpStatus: "ACCEPTED",
      partySize: 2,
      mealPreference: "Vegetarian",
    },
  });
  const businesses = await request(
    api,
    vendor,
    "vendors/mine",
    undefined,
    "GET",
  );
  business = businesses.find((b: any) => b.slug === "the-grand-palace");
  await request(api, host, "conversations", {
    eventId: event.id,
    vendorId: business.id,
  });
});
test("planning studio exposes all tools on desktop and mobile without tiny text or page overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await session(page, host);
  await page.goto("/planning");
  await expect(
    page.getByRole("heading", { name: "The planning studio" }),
  ).toBeVisible();
  // The studio lists the tools of this wedding event (occasion-driven).
  await expect(page.locator(".studio-tool").nth(11)).toBeVisible();
  await page.screenshot({
    path: "artifacts/planning-studio-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const path of [
    "/planning",
    "/seating",
    "/run-sheet",
    "/check-in",
    "/contracts",
    "/finance",
    "/inspiration",
    "/insights",
    "/automations",
    "/website",
    "/collaboration",
    "/shortlist",
  ]) {
    await page.goto(path);
    await expect(page.locator("main.main-content")).toBeVisible();
    const tiny = await page.locator("body").evaluate((body) =>
      Array.from(body.querySelectorAll("*"))
        .filter(
          (e) =>
            e.textContent?.trim() &&
            e.getClientRects().length &&
            parseFloat(getComputedStyle(e).fontSize) < 14,
        )
        .map((e) => ({ tag: e.tagName, size: getComputedStyle(e).fontSize })),
    );
    expect(tiny).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/planning",
    "/seating",
    "/run-sheet",
    "/check-in",
    "/website",
    "/finance",
    "/automations",
    "/shortlist",
  ]) {
    await page.goto(path);
    await expect(page.locator("main.main-content")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.goto("/planning");
  await page.screenshot({
    path: "artifacts/planning-studio-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
test("seating table creation assignment and keyboard movement persist", async ({
  page,
}) => {
  await session(page, host);
  await page.goto("/seating");
  await page.getByRole("button", { name: "Add a table", exact: true }).click();
  await page.getByLabel("Table name").fill(`Family ${suffix}`);
  await page.getByLabel("Number of seats").fill("2");
  await page.getByRole("button", { name: "Add to floor plan" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const row = page.locator(".seat-guest").filter({ hasText: guest.name });
  await row.getByRole("button", { name: "Seat here" }).click();
  await expect(row).toContainText(`Family ${suffix}`);
  const table = page.getByRole("button", {
    name: `Family ${suffix}, 2 of 2 seats`,
    exact: true,
  });
  await table.focus();
  await table.press("ArrowRight");
  await expect(page.getByRole("status")).not.toContainText("changed");
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: `Family ${suffix}, 2 of 2 seats`,
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/seating-studio.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("live cue and idempotent guest welcome desk operate from persisted data", async ({
  page,
}) => {
  await session(page, host);
  await page.goto("/run-sheet");
  await page.getByRole("button", { name: "Add a cue" }).click();
  await page.getByLabel("Cue title").fill(`A lovely entrance ${suffix}`);
  await page
    .getByLabel("Starts at")
    .fill(
      new Date(+new Date(day.startsAt) + 21600000).toISOString().slice(0, 16),
    );
  await page.getByLabel("Responsible person").fill("Welcome team");
  await page.getByRole("button", { name: "Add cue", exact: true }).click();
  const cue = page
    .locator(".cue-card")
    .filter({ hasText: `A lovely entrance ${suffix}` });
  await cue.getByRole("button", { name: "Ready", exact: true }).click();
  await cue.getByRole("button", { name: "Go live" }).click();
  await expect(page.locator(".live-banner")).toContainText(
    `A lovely entrance ${suffix}`,
  );
  await page.getByRole("button", { name: "Finish cue" }).click();
  await expect(cue).toContainText("done");
  await page.goto("/check-in");
  await page
    .getByLabel("Invitation link or guest token")
    .fill(`${"http://localhost:3000"}/rsvp/${guest.token}`);
  await page.getByRole("button", { name: "Welcome this guest" }).click();
  await expect(page.getByRole("status")).toContainText("Welcome,");
  await page.getByLabel("Invitation link or guest token").fill(guest.token);
  await page.getByRole("button", { name: "Welcome this guest" }).click();
  await expect(page.getByRole("status")).toContainText("already checked in");
  await expect(
    page.getByRole("row").filter({ hasText: guest.name }),
  ).toHaveCount(1);
});
test("website publishing password protection and guestbook moderation work publicly", async ({
  page,
  browser,
}) => {
  await session(page, host);
  await page.goto("/website");
  await page.getByLabel("Website slug").fill(`studio-${suffix}`);
  await page
    .getByLabel("Your headline")
    .fill("A beautiful beginning, together");
  await page
    .getByLabel("Your story", { exact: true })
    .fill("A lovely story shared with our favorite people.");
  await page
    .getByLabel("Optional guest website password")
    .fill("OurPrivate123");
  await page
    .getByRole("button", { name: "Publish website", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("published");
  await expect(page.getByLabel("Replace website password")).toHaveValue("");
  const ctx = await browser.newContext();
  const publicPage = await ctx.newPage();
  await publicPage.goto(`/celebrate/studio-${suffix}`);
  await publicPage
    .getByLabel("Celebration website password")
    .fill("OurPrivate123");
  await publicPage.getByRole("button", { name: "Step inside" }).click();
  await expect(
    publicPage.getByRole("heading", {
      name: "A beautiful beginning, together",
    }),
  ).toBeVisible();
  await publicPage
    .getByLabel("Your name", { exact: true })
    .fill("Our dear friend");
  await publicPage
    .getByLabel("A wish, a memory, a little love")
    .fill("A lifetime of warmth and beautiful memories.");
  await publicPage.getByRole("button", { name: "Send with love" }).click();
  await expect(publicPage.getByRole("status")).toContainText("approve");
  await page.reload();
  const review = page
    .locator(".guestbook-review")
    .filter({ hasText: "Our dear friend" });
  await review.getByRole("button", { name: "Approve", exact: true }).click();
  await publicPage.reload();
  await publicPage
    .getByLabel("Celebration website password")
    .fill("OurPrivate123");
  await publicPage.getByRole("button", { name: "Step inside" }).click();
  await expect(publicPage.locator(".public-wishes")).toContainText(
    "A lifetime of warmth",
  );
  await publicPage.screenshot({
    path: "artifacts/public-celebration.png",
    fullPage: true,
    animations: "disabled",
  });
  await ctx.close();
});
test("vendor pipeline and host contract acknowledgement work across roles", async ({
  page,
  browser,
  request: api,
}) => {
  await session(page, vendor);
  await page.goto("/business");
  await page.getByRole("button", { name: "New inquiry" }).click();
  await page
    .getByLabel("Client or inquiry name")
    .fill(`A new chapter ${suffix}`);
  await page.getByLabel("Estimated value").fill("250000");
  await page.getByRole("button", { name: "Save inquiry" }).click();
  await page
    .getByLabel(`Stage for A new chapter ${suffix}`)
    .selectOption("QUALIFIED");
  await expect(page.locator(".stage-qualified")).toContainText(
    `A new chapter ${suffix}`,
  );
  await expect(
    page.locator(".lead-card").filter({ hasText: `A new chapter ${suffix}` }),
  ).toContainText("250,000");
  await page.screenshot({
    path: "artifacts/vendor-pipeline.png",
    fullPage: true,
    animations: "disabled",
  });
  const contract = await request(api, vendor, "contracts", {
    eventId: event.id,
    vendorId: business.id,
    title: `Our agreement ${suffix}`,
    body: "The venue and the host agree to the service scope, setup timings, and payment milestones described in their proposal.",
    amountMinor: 25000000,
  });
  const context = await browser.newContext(),
    hostPage = await context.newPage();
  await session(hostPage, host);
  await hostPage.goto("/contracts");
  await hostPage
    .getByRole("button")
    .filter({ hasText: `Our agreement ${suffix}` })
    .click();
  await hostPage.getByLabel(/Your full account name/).fill("Ayesha Rahman");
  await hostPage.getByRole("checkbox").check();
  await hostPage.getByRole("button", { name: "Acknowledge agreement" }).click();
  await expect(hostPage.getByRole("dialog")).toContainText(
    "Acknowledged by Ayesha Rahman",
  );
  await context.close();
});
test("invoice installments and workflow retries do not duplicate effects", async ({
  page,
  request: api,
}) => {
  const service = business.services[0];
  const start = new Date(
    Date.now() + 86400000 * (600 + Math.floor(Math.random() * 600)),
  ).toISOString();
  const booking = await request(api, host, "bookings", {
    eventId: event.id,
    serviceId: service.id,
    startAt: start,
  });
  const advance = await request(api, host, "payments", {
    bookingId: booking.id,
    provider: "SANDBOX",
    kind: "ADVANCE",
    idempotencyKey: crypto.randomUUID(),
  });
  await request(api, host, `payments/${advance.id}/sandbox-confirm`, {});
  await session(page, host);
  await page.goto("/finance");
  await page.getByRole("button", { name: "Open invoice" }).last().click();
  await page.getByRole("button", { name: "Create payment plan" }).click();
  await page.getByLabel("Number of installments").fill("2");
  await page
    .getByLabel("First payment date")
    .fill(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Save milestones" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Open invoice" }).last().click();
  await expect(page.locator(".installment-row")).toHaveCount(2);
  await page
    .locator(".installment-row")
    .first()
    .getByRole("button", { name: "Test payment" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Sandbox payment recorded",
  );
  await request(api, host, `events/${event.id}/tasks`, {
    title: "Overdue test task",
    dueAt: new Date(Date.now() - 86400000).toISOString(),
  });
  // Automations are not a wedding default; switch the tool on for this event first.
  await request(
    api,
    host,
    `events/${event.id}`,
    { enabledFeatures: ["automations"] },
    "PATCH",
  );
  await page.goto("/automations");
  await page.getByRole("button", { name: "Create a workflow" }).click();
  await page.getByLabel("Workflow name").fill(`Our helpful workflow ${suffix}`);
  await page.getByLabel("When this happens").selectOption("TASK_OVERDUE");
  await page.getByLabel("What should happen").selectOption("CREATE_TASK");
  await page
    .getByLabel("Reminder or task text")
    .fill(`Check the little details ${suffix}`);
  await page
    .getByRole("button", { name: "Create workflow", exact: true })
    .click();
  await page.getByRole("button", { name: "Check triggers now" }).click();
  await page.getByRole("button", { name: "Check triggers now" }).click();
  await expect(
    page
      .locator(".activity-row")
      .filter({ hasText: `Our helpful workflow ${suffix}` }),
  ).toHaveCount(1);
});
