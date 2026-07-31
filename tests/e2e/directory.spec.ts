import { test, expect, type Page } from "@playwright/test";

/**
 * Navigate, then wait until the client bundle has actually run.
 *
 * /tools used to ship a Suspense fallback, so its grid and filters did not
 * exist until hydration and a test could not interact too early even by
 * accident. Now the markup server-renders, which is the point, but it means a
 * filter button is visible and clickable while its handler is not yet attached:
 * Playwright clicks it, nothing happens, and the failure looks like a broken
 * filter rather than a race. Waiting for the network to settle is the cheap
 * proxy for "hydration has run".
 */
async function gotoHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

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
    await gotoHydrated(page, "/tools");

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
    await gotoHydrated(page, "/tools");
    await page.getByRole("button", { name: "Free", exact: true }).click();
    await expect(page).toHaveURL(/price=free/);
    // At least one result remains and the count text is present.
    await expect(page.getByText(/\d+ tools?/).first()).toBeVisible();
  });

  test("a filtered deep link applies its filter and keeps the query string", async ({
    page,
  }) => {
    // Guards the mount-read gate: the URL-sync effect must not fire with
    // default state before the URL has been read, or it strips these params.
    await page.goto("/tools?cat=coding");
    const cards = page.locator('a[href^="/tools/"]');
    await expect.poll(() => cards.count()).toBeLessThan(27);
    await expect(page).toHaveURL(/cat=coding/);
  });

  test("a signed-out visitor is offered sign-in as the review entry point", async ({
    page,
  }) => {
    // Writing a review needs an account: `ReviewModal` returns a sign-in link
    // instead of the modal trigger when `user` is null. Automation cannot create
    // an account (handoff.md gotcha 4), so the modal itself is out of reach; the
    // rating rule it enforces is pinned in src/lib/schemas.test.ts instead.
    // What is reachable, and what actually matters, is that a signed-out visitor
    // still finds the way in and gets carried back here afterwards.
    //
    // Supabase is cut off on purpose. This project runs on a free tier that
    // auto-pauses, so the entry point has to come from server-rendered markup
    // rather than a live session check. Without this the test would flip red in
    // CI whenever the database happened to be asleep.
    await page.route(/supabase\.co/, (route) => route.abort());

    await page.goto("/tools/elevenlabs");
    await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();

    // The modal trigger is for signed-in users only. Showing it here would open
    // a form whose submit handler returns early, so nothing would be saved.
    await expect(
      page.getByRole("button", { name: "Write a review" }),
    ).toHaveCount(0);

    const signIn = page.getByRole("link", { name: "Sign in to review" }).first();
    await expect(signIn).toBeVisible();
    await signIn.click();

    // The redirect param is what returns them to this tool after signing in.
    // Drop it and every review attempt ends on the home page.
    await expect(page).toHaveURL(
      /\/login\?redirect=(%2F|\/)tools(%2F|\/)elevenlabs/,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Save what you trust" }),
    ).toBeVisible();
  });

  test("command palette opens and navigates", async ({ page }) => {
    await gotoHydrated(page, "/");
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder(/Search tools/).fill("perplexity");
    // Target the option, not any text node. Fuse.js is dynamically imported on
    // first open, so the list re-renders once it lands; getByText().first()
    // could resolve a group heading or a row that is about to be replaced, and
    // the click would then hit something with no select handler. Scoped to the
    // dialog because "Perplexity" also appears on the page behind the overlay.
    const option = dialog.getByRole("option", { name: /Perplexity/i }).first();
    await expect(option).toBeVisible();
    await option.click();
    await expect(page).toHaveURL(/\/tools\/perplexity/);
  });
});
