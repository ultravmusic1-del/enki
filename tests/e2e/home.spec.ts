import { test, expect } from "@playwright/test";

test.describe("Enki Daily home and news", () => {
  test("the home page is the Enki Daily funnel", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("AI news for founders");
    await expect(page.locator("#subscribe")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Before you subscribe" })).toBeVisible();
  });

  test("/news shows the front page", async ({ page }) => {
    await page.goto("/news");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Today's brief");
    await expect(page.getByTestId("lead-story").locator('a[href^="/news/"]').first()).toBeVisible();
  });

  test("/news/search finds past stories", async ({ page }) => {
    await page.goto("/news/search?q=ai");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search the news");
    await expect(page.getByRole("searchbox", { name: "Search the news" })).toHaveValue("ai");
  });

  test("/welcome confirms the signup", async ({ page }) => {
    await page.goto("/welcome?from=home");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("You're in.");
  });
});
