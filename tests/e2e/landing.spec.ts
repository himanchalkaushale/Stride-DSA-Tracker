import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("connects the product story to the account routes", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: /practice that/i })).toBeVisible();
    const navigation = page.getByRole("navigation", { name: "Main navigation" });
    await expect(navigation.getByRole("link", { name: "Product", includeHidden: true })).toHaveAttribute("href", "#product");
    const workflowLink = navigation.getByRole("link", { name: "Workflow", includeHidden: true });
    await expect(workflowLink).toHaveAttribute("href", "#workflow");
    await expect(navigation.getByRole("link", { name: "Insights", includeHidden: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toHaveAttribute("href", "/auth");

    const createLinks = page.getByRole("link", { name: /create (your|a) (free )?workspace/i });
    await expect(createLinks.first()).toHaveAttribute("href", "/auth/create-account");
    await expect(page.getByAltText(/analytics dashboard showing daily momentum/i)).toBeVisible();

    await workflowLink.evaluate((link: HTMLAnchorElement) => link.click());
    await expect(page).toHaveURL(/#workflow$/);
    await expect(page.getByRole("heading", { name: /more than a problem counter/i })).toBeInViewport();
  });

  test("keeps the product preview visible on a narrow screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const preview = page.getByAltText(/analytics dashboard showing daily momentum/i);
    await expect(preview).toBeVisible();
  });

  test("lets visitors explore every stage of the practice loop", async ({ page }) => {
    await page.goto("/");

    const loop = page.getByRole("list", { name: /five stages of deliberate practice/i });
    const plan = loop.getByRole("radio", { name: /01, plan/i });
    const improve = loop.getByRole("radio", { name: /05, improve/i });

    await expect(plan).toBeChecked();
    await loop.locator('label[for="practice-step-5"]').click();
    await expect(improve).toBeChecked();
    await expect(plan).not.toBeChecked();
    await expect(loop).toHaveCSS("--loop-progress", "100%");
  });

  test("removes decorative motion when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const floatingCard = page.locator(".lp-float-card").first();
    await expect(floatingCard).toHaveCSS("animation-name", "none");
  });
});
