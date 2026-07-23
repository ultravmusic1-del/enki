import { test, expect } from "@playwright/test";

test.describe("Ask the Oracle finder", () => {
  test("walks the 3-step flow and shows reasoned results", async ({ page }) => {
    await page.goto("/finder");

    // Q1 use-case
    await expect(
      page.getByRole("heading", { name: "What do you want to do?" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: /Write code/ }).click();

    // Q2 budget
    await expect(
      page.getByRole("heading", { name: "How do you want to pay?" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: /Free to start/ }).click();

    // Q3 platform
    await expect(
      page.getByRole("heading", { name: "Where do you need it to run?" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: /Dev \/ API/ }).click();

    // Results
    await expect(page.getByText("The Oracle recommends")).toBeVisible();
    const cards = page.locator('a[href^="/tools/"]');
    await expect(cards.first()).toBeVisible();
    // The URL reflects the answers (shareable).
    await expect(page).toHaveURL(/use=coding/);
    await expect(page).toHaveURL(/budget=free/);
    await expect(page).toHaveURL(/platform=api/);

    // Start over returns to Q1.
    await page.getByRole("button", { name: "Start over" }).click();
    await expect(
      page.getByRole("heading", { name: "What do you want to do?" }),
    ).toBeVisible();
  });

  test("a shared URL lands directly on results", async ({ page }) => {
    await page.goto("/finder?use=image&budget=pay&platform=any");
    await expect(page.getByText("The Oracle recommends")).toBeVisible();
  });
});
