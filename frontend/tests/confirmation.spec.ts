import { expect, test } from "@playwright/test";

test("guest removal requires confirmation and dismissal leaves the guest intact", async ({
  page,
}) => {
  const login = await page.request.post("/api/auth/login", {
    data: {
      email: "host@utsab.local",
      password: "UtsabDemo2027!",
      client: "web",
    },
  });
  expect(login.ok()).toBeTruthy();
  const name = `Confirmation guest ${Date.now()}`;
  const created = await page.request.post(
    "/api/events/event-ayesha-raihan/guests",
    {
      headers: { "x-ayojon-client": "web" },
      data: { name, maxPartySize: 1, groupName: "Friends" },
    },
  );
  expect(created.ok()).toBeTruthy();
  let deletes = 0;
  page.on("request", (request) => {
    if (request.method() === "DELETE" && request.url().includes("/guests/"))
      deletes++;
  });
  await page.goto("/guests");
  await page
    .getByRole("combobox", { name: "Choose event" })
    .selectOption("event-ayesha-raihan");
  const remove = page.getByRole("button", { name: `Remove ${name}` });
  await remove.click();
  const dialog = page.getByRole("dialog", { name: "Please confirm" });
  await expect(dialog).toContainText(`Remove ${name}`);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(remove).toBeVisible();
  expect(deletes).toBe(0);
  await remove.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(deletes).toBe(0);
  await remove.click();
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(remove).toHaveCount(0);
  expect(deletes).toBe(1);
});

test("removing a website answer can be cancelled or confirmed", async ({
  page,
}) => {
  const login = await page.request.post("/api/auth/login", {
    data: {
      email: "host@utsab.local",
      password: "UtsabDemo2027!",
      client: "web",
    },
  });
  expect(login.ok()).toBeTruthy();
  await page.goto("/website");
  await page
    .getByRole("combobox", { name: "Choose event" })
    .selectOption("event-ayesha-raihan");
  await page.getByRole("button", { name: /add.*(question|answer)/i }).click();
  const remove = page
    .getByRole("button", { name: "Remove this answer" })
    .last();
  const count = await page
    .getByRole("button", { name: "Remove this answer" })
    .count();
  await remove.click();
  const dialog = page.getByRole("dialog", { name: "Please confirm" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("button", { name: "Remove this answer" }),
  ).toHaveCount(count);
  await remove.click();
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(
    page.getByRole("button", { name: "Remove this answer" }),
  ).toHaveCount(count - 1);
});
