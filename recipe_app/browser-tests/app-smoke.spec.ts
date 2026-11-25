import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/auth/v1/session*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: null, token_type: "bearer", expires_in: 0, expires_at: 0, refresh_token: "", user: null }),
    });
  });
});

test("boots the public login experience without browser errors", async ({ page }) => {
  const pageErrors: Error[] = [];
  const failedRequests: string[] = [];
  const badResponses: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));
  page.on("response", (response) => {
    if (response.url().startsWith(page.url().split("/login")[0]) && response.status() >= 400) {
      badResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.locator("link[rel=stylesheet]")).toHaveCount(1);

  expect(pageErrors, pageErrors.map((error) => error.message).join("\n")).toEqual([]);
  expect(failedRequests, failedRequests.join("\n")).toEqual([]);
  expect(badResponses, badResponses.join("\n")).toEqual([]);
});

test("renders the password-reset experience", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("loads protected route chunks and redirects unauthenticated users", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  for (const route of ["/", "/recipes/new", "/pantry", "/shopping", "/popular", "/profile"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  }
  expect(pageErrors, pageErrors.map((error) => error.message).join("\n")).toEqual([]);
});
