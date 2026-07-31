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

    const quickTodo = `Quick todo ${Date.now()}`;
    await page.getByLabel("Quick add a todo for today").fill(quickTodo);
    await page.locator(".todo-quick-add").getByRole("button").click();
    const quickTodoRow = page.locator(".todo-card-list label").filter({ hasText: quickTodo });
    await expect(quickTodoRow).toBeVisible();
    await quickTodoRow.getByRole("checkbox").check();
    await expect(quickTodoRow).toHaveClass(/completed/);
    await quickTodoRow.getByRole("checkbox").uncheck();

    await page.getByRole("link", { name: "Todos" }).first().click();
    await expect(page).toHaveURL(/\/todos/);
    await expect(page.getByRole("heading", { name: "Todos" })).toBeVisible();
    const selectedDate = await page.getByLabel("Selected date").inputValue();
    const yesterdayDate = new Date(`${selectedDate}T12:00:00Z`);
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);
    const datedTodo = `Dated todo ${Date.now()}`;
    await page.getByLabel("Title").fill(datedTodo);
    await page.getByLabel("Date").fill(yesterday);
    await page.getByLabel(/notes/i).fill("Acceptance todo notes");
    await page.getByRole("button", { name: "Add todo" }).click();
    await expect(page).toHaveURL(new RegExp(`date=${yesterday}`));
    const datedRow = page.locator(".todo-item").filter({ hasText: datedTodo });
    await expect(datedRow).toContainText("Acceptance todo notes");
    await datedRow.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Title").fill(`${datedTodo} edited`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(`${datedTodo} edited`)).toBeVisible();
    await page.getByRole("button", { name: "Today" }).click();
    await expect(page.getByText(/overdue todo/i)).toBeVisible();
    await page.getByText(/overdue todo/i).first().click();
    const editedRow = page.locator(".todo-item").filter({ hasText: `${datedTodo} edited` });
    await editedRow.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: /^delete$/i }).click();
    await expect(editedRow).toHaveCount(0);

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
