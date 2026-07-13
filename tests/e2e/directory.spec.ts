import { test, expect } from "@playwright/test";

test.describe("Enki critical flow", () => {
  test("landing page loads with hero and featured tools", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toContainText("AI tools");
    await expect(
      page.getByRole("heading", { name: "Featured tools" }),
    ).toBeVisible();
  });

  test("search → filter → open a tool detail page", async ({ page }) => {
    await page.goto("/tools");

    // Search narrows results and syncs to the URL.
    const search = page.getByRole("textbox", { name: "Search tools" });
    await search.fill("cursor");
    await expect(page).toHaveURL(/q=cursor/);

    // The Cursor card appears; open it.
    const cursorCard = page.locator('a[href="/tools/cursor"]').first();
    await expect(cursorCard).toBeVisible();
    await cursorCard.click();

    // Detail page renders.
    await expect(page).toHaveURL(/\/tools\/cursor/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Cursor" }),
    ).toBeVisible();
    await expect(page.getByText("Editor score")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Visit Cursor/ }),
    ).toBeVisible();
  });

  test("pricing filter narrows the directory and is reflected in the URL", async ({
    page,
  }) => {
    await page.goto("/tools");
    await page.getByRole("button", { name: "Free", exact: true }).click();
    await expect(page).toHaveURL(/price=free/);
    // At least one result remains and the count text is present.
    await expect(page.getByText(/\d+ tools?/).first()).toBeVisible();
  });

  test("review modal validates required fields", async ({ page }) => {
    await page.goto("/tools/elevenlabs");
    await page
      .getByRole("button", { name: "Write a review" })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Submit review" }).click();
    await expect(dialog.getByText("Please choose a rating")).toBeVisible();
  });

  test("command palette opens and navigates", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder(/Search tools/).fill("perplexity");
    await page.getByText("Perplexity").first().click();
    await expect(page).toHaveURL(/\/tools\/perplexity/);
  });
});
