import { test, expect } from "@playwright/test";

test.describe("Trust paths", () => {
  test("the admin route redirects an anonymous visitor to login", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
    // The URL alone would also be satisfied by a redirect to an error page
    // whose path happened to contain "login", so assert the form is really there.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("the submit form validates before it posts", async ({ page }) => {
    await page.goto("/submit");
    // The form server-renders, so it exists before React has attached its
    // handler. Firing requestSubmit() too early falls through to a native GET
    // and the assertions below then fail for a reason that looks unrelated.
    await page.waitForLoadState("networkidle");
    // handoff.md gotcha 3: a synthetic click may not fire React Hook Form's
    // handleSubmit, which silently masked this flow once before.
    await page
      .locator("form")
      .first()
      .evaluate((f: HTMLFormElement) => f.requestSubmit());
    await expect(
      page.getByText(/required|enter|check the form/i).first(),
    ).toBeVisible();
    // "before it posts" is half the claim, and the half the message alone does
    // not prove. A native GET submit would put the empty fields in the query
    // string, so an unchanged URL is what shows the post never happened.
    await expect(page).toHaveURL(/\/submit$/);
  });

  test("the directory is server-rendered, not JavaScript-only", async ({
    browser,
  }) => {
    // Guards the regression this branch fixed: useSearchParams forced a
    // prerender bail-out and /tools shipped a skeleton with no tool links.
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/tools");
    expect(await page.locator('a[href^="/tools/"]').count()).toBeGreaterThan(5);
    await context.close();
  });

  test("an alternatives page lists only same-category tools", async ({
    page,
  }) => {
    await page.goto("/alternatives/cursor");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Cursor");
    await expect(page.locator('a[href="/tools/midjourney"]')).toHaveCount(0);
    await expect(page.locator('a[href="/tools/elevenlabs"]')).toHaveCount(0);
  });
});
