import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 404, json: {} }),
  );
});

test("public language choice persists across landing, legal and RSVP pages", async ({
  page,
}) => {
  await page.route("**/api/rsvp/locale-test", (route) =>
    route.fulfill({
      json: {
        name: "Guest",
        rsvpStatus: "PENDING",
        partySize: 1,
        maxPartySize: 2,
        card: null,
        livestreamUrl: null,
        event: { title: "Celebration", days: [] },
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to Bangla" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(
    page.getByRole("heading", { name: /উদযাপনের প্রতিটি কারণ/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "শর্তাবলি" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(
    page.getByRole("heading", { name: "সেবার শর্তাবলি" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.getByRole("link", { name: "গোপনীয়তা" })).toBeVisible();
  await page.goto("/rsvp/locale-test");
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.getByText("পরিবারের সবার পক্ষ থেকে")).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Every reason/ }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("Bangla landing navigation and occasion selection work on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to Bangla" }).click();
  await page.getByRole("button", { name: "মেনু খুলুন" }).click();
  await expect(
    page
      .getByRole("navigation", { name: "প্রধান নেভিগেশন" })
      .getByRole("link", { name: "যেভাবে কাজ করে" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "মেনু বন্ধ করুন" }).click();
  await page.getByRole("button", { name: "বিয়ে", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "বিয়ে পরিকল্পনা করুন" }),
  ).toHaveAttribute("href", "/signup?event=WEDDING");
});
