import { expect, test, type Page } from "@playwright/test";

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
});
test.afterEach(() => expect(errors).toEqual([]));

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function command(page: Page, text: string) {
  const input = page.getByRole("textbox", { name: /command$/ });
  await input.fill(text);
  await input.press("Enter");
}

test("home links to the chapter, playground, and cheatsheet", async ({ page }) => {
  await page.goto("/");
  await noHorizontalOverflow(page);
  await expect(page.getByText("Pods (coming soon)")).toBeVisible();
  await page.getByRole("link", { name: "Deployments" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Deployments" })).toBeVisible();
  await noHorizontalOverflow(page);
  for (const name of ["Playground", "Cheatsheet"]) {
    await page.getByRole("navigation").getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  }
});

test("lab completes through the terminal and resets", async ({ page }) => {
  await page.goto("/chapters/deployments");
  const lab = page.getByRole("region", { name: /Lab:/ });
  await expect(lab.getByText("○ The web Deployment asks for 3 replicas.")).toBeVisible();

  await command(page, "kubectl scale deployment web --replicas=3");
  await expect(lab.getByRole("log")).toContainText("deployment.apps/web scaled");
  await expect(lab.getByText("✓ The web Deployment asks for 3 replicas.")).toBeVisible();
  await expect(lab.getByText("○ 3 Pods owned by web are ready.")).toBeVisible();

  await command(page, "kubectl get pods");
  await expect(lab.getByRole("log")).toContainText("ContainerCreating");
  await expect(lab.getByText("Lab complete.")).toBeVisible();

  await command(page, "rm -rf /");
  await expect(lab.getByRole("log")).toContainText("command not found: rm");

  await lab.getByText("Hint 1").click();
  await expect(lab.getByText(/Start with kubectl get deployments/)).toBeVisible();

  await page.getByRole("button", { name: "Reset lab" }).click();
  await expect(lab.getByText("○ The web Deployment asks for 3 replicas.")).toBeVisible();
  await expect(lab.getByRole("log")).not.toContainText("scaled");
});

test("terminal history recalls previous commands", async ({ page }) => {
  await page.goto("/playground");
  await command(page, "kubectl get nodes");
  const input = page.getByRole("textbox", { name: /command$/ });
  await input.press("ArrowUp");
  await expect(input).toHaveValue("kubectl get nodes");
});

test("diagram follows the cluster and shows details", async ({ page }) => {
  await page.goto("/playground");
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await page.locator(".react-flow__node", { hasText: "toolbox" }).click();
  await expect(page.getByText(/Controlled By:\s+<none>/)).toBeVisible();

  await command(page, "kubectl delete pod toolbox");
  await expect(page.locator(".react-flow__node")).toHaveCount(4);
  await expect(page.getByText("That resource no longer exists.")).toBeVisible();
  await noHorizontalOverflow(page);
});

test("quiz gives feedback and can be retried", async ({ page }) => {
  await page.goto("/chapters/deployments");
  const quiz = page.getByRole("region", { name: "Quiz" });
  await quiz.getByRole("button", { name: "A ReplicaSet owned by the Deployment" }).click();
  await expect(quiz.getByText("Correct.")).toBeVisible();
  await quiz.getByRole("button", { name: "The Deployment drops to 2 replicas" }).click();
  await expect(quiz.getByText("Not quite.")).toBeVisible();
  await expect(quiz.getByText(/Desired state is still 3/)).toBeVisible();
  await quiz.getByRole("button", { name: "Retry quiz" }).click();
  await expect(quiz.getByText("0 of 4 answered.")).toBeVisible();
});

test("cheatsheet searches and copies", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/cheatsheet");
  const search = page.getByLabel("Search commands and manifests");
  await search.fill("scale");
  await expect(page.getByRole("heading", { name: "Scale a Deployment" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "List Pods", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Copy" }).first().click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("kubectl scale deployment web --replicas=3");
  await search.fill("zzz");
  await expect(page.getByText("No entries match")).toBeVisible();
  await noHorizontalOverflow(page);
});

test("keyboard focus is visible", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe("none");
});
