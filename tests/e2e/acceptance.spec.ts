import { expect, test } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe("complete daily practice acceptance flow", () => {
  test.skip(!email || !supabaseUrl || !serviceRoleKey, "Set E2E_USER_EMAIL, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY for a migrated test project.");

  test("signs in, onboards, plans, solves, reviews, and updates analytics", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("Email").fill(email!);
    await page.getByRole("button", { name: /continue with email/i }).click();
    await expect(page.getByRole("status")).toContainText(/link/i);

    const linkResponse = await page.request.post(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      headers: { apikey: serviceRoleKey!, Authorization: `Bearer ${serviceRoleKey}` },
      data: { type: "magiclink", email, options: { redirectTo: `${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/auth/callback` } },
    });
    expect(linkResponse.ok()).toBeTruthy();
    const linkPayload = await linkResponse.json() as { properties: { action_link: string } };
    await page.goto(linkPayload.properties.action_link);

    await page.waitForURL(/\/(onboarding|today)/);
    if (page.url().includes("/onboarding")) {
      await page.getByLabel(/display name/i).fill("Acceptance User");
      await page.getByRole("button", { name: /create my workspace/i }).click();
    }
    await expect(page).toHaveURL(/\/today/);
    await expect(page.getByText("Daily practice plan")).toBeVisible();

    await page.goto("/problems");
    await page.getByRole("button", { name: /add question/i }).click();
    const title = `Acceptance problem ${Date.now()}`;
    await page.getByLabel(/title/i).fill(title);
    await page.getByLabel(/topics/i).fill("Arrays");
    await page.getByRole("button", { name: /^add question$/i }).click();
    await expect(page.getByText(title)).toBeVisible();
    await page.getByText(title).click();

    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("function solve() { return true; }");
    await page.getByPlaceholder(/core idea/i).fill("Direct acceptance-test solution.");
    await expect(page.getByText(/saved to cloud/i)).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /record attempt/i }).click();
    await page.getByLabel(/time spent/i).fill("12");
    await page.getByRole("button", { name: /^record attempt$/i }).click();
    await expect(page.getByText(/review scheduled/i)).toBeVisible();

    await page.goto("/today");
    await expect(page.getByText(/recent activity/i)).toBeVisible();
    await page.goto("/analytics");
    await expect(page.getByText("Attempt efficiency")).toBeVisible();
    await expect(page.getByText("Topic mastery")).toBeVisible();
  });
});
