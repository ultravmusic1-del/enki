import { test, expect } from "@playwright/test";

test.describe("Trust paths", () => {
  test("the admin route redirects an anonymous visitor to login", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the submit form validates before it posts", async ({ page }) => {
    await page.goto("/submit");
    // handoff.md gotcha 3: a synthetic click may not fire React Hook Form's
    // handleSubmit, which silently masked this flow once before.
    await page
      .locator("form")
      .first()
      .evaluate((f: HTMLFormElement) => f.requestSubmit());
    await expect(
      page.getByText(/required|enter|check the form/i).first(),
    ).toBeVisible();
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
