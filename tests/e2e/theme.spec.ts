import { expect, test } from "@playwright/test";

test.describe("appearance", () => {
  test("applies the system palette before the page becomes interactive", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  });

  test("persists an explicit choice across reloads and routes", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    await page.getByRole("button", { name: /appearance:/i }).click();
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("stride.theme"))).toBe("light");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("link", { name: /sign in/i }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: /appearance: light, currently light/i })).toBeVisible();
  });

  test("follows live operating-system changes only in System mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.getByRole("button", { name: /appearance:/i }).click();
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("offers a keyboard-operable, named appearance menu", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: /appearance:/i });
    await trigger.focus();
    await page.keyboard.press("Enter");

    const system = page.getByRole("menuitemradio", { name: "System" });
    await expect(system).toBeVisible();
    await expect(system).toHaveAttribute("aria-checked", "true");
    await system.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("menuitemradio", { name: "Dark" })).toBeFocused();
  });
});
