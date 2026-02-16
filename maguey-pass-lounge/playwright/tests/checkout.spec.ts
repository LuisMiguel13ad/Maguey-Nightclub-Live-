import { test, expect } from "@playwright/test";

test.describe("Checkout flow", () => {
  test("walks through selecting event tickets and checkout confirmation", async ({
    page,
  }) => {
    await page.goto("/events");

    await expect(page.getByRole("heading", { name: /events/i })).toBeVisible();

    const firstEventCard = page.locator("a[href^='/event/']").first();
    await expect(firstEventCard).toBeVisible();
    await Promise.all([
      page.waitForURL("**/event/**"),
      firstEventCard.click(),
    ]);

    const ticketsSection = page.locator("#tickets");
    await expect(ticketsSection).toBeVisible();

    const buyTicketButton = ticketsSection
      .getByRole("button", { name: /buy tickets/i })
      .first();

    await Promise.all([
      page.waitForURL("**/checkout**"),
      buyTicketButton.click(),
    ]);

    await expect(page).toHaveURL(/\/checkout/);

    const addTicketButton = page
      .getByRole("button", { name: /^add /i })
      .first();
    await addTicketButton.click();

    const checkoutButton = page.getByRole("button", { name: /^checkout$/i });
    await expect(checkoutButton).toBeEnabled();
    await checkoutButton.click();

    await page.waitForURL("**/payment**");

    await expect(page.getByRole("heading", { name: /payment/i })).toBeVisible();

    await page.getByLabel("Email address").fill("playwright@example.com");
    await page.getByLabel("Card number").fill("4242 4242 4242 4242");
    await page.getByLabel("Expiration date").fill("12/30");
    await page.getByLabel("Security code").fill("123");
    await page.getByLabel("First name").fill("Playwright");
    await page.getByLabel("Last name").fill("Tester");
    await page.getByLabel("Country or region").selectOption("United States");
    await page.getByLabel("Address").fill("123 Main St");

    await page.getByRole("button", { name: /complete purchase/i }).click();

    await expect(
      page.getByRole("heading", { name: /payment successful/i })
    ).toBeVisible();

    const lastOrderStorage = await page.evaluate(() =>
      sessionStorage.getItem("maguey:lastOrder")
    );
    expect(lastOrderStorage).toBeTruthy();

    const parsed = JSON.parse(lastOrderStorage ?? "{}");
    expect(parsed?.order?.id).toBeTruthy();
    expect(Array.isArray(parsed?.tickets)).toBeTruthy();
  });
});

