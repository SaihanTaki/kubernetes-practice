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

test("home links every chapter, playground, and cheatsheet", async ({ page }) => {
  await page.goto("/");
  await noHorizontalOverflow(page);
  await expect(page.getByText("(coming soon)")).toHaveCount(0);
  for (const name of ["Kubernetes Architecture", "Pods", "ReplicaSets", "Deployments"]) {
    await expect(page.getByRole("main").getByRole("link", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: "Deployments" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Deployments" })).toBeVisible();
  for (const name of ["Playground", "Cheatsheet"]) {
    await page.getByRole("navigation").getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  }
});

for (const [slug, title] of [
  ["architecture", "Kubernetes Architecture"],
  ["pods", "Pods"],
  ["replicasets", "ReplicaSets"],
  ["deployments", "Deployments"],
]) {
  test(`chapter ${slug} renders`, async ({ page }) => {
    await page.goto(`/chapters/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await noHorizontalOverflow(page);
  });
}

test("architecture diagram walkthrough and details", async ({ page }) => {
  await page.goto("/chapters/architecture");
  await page.getByRole("button", { name: "Start walkthrough" }).click();
  await expect(page.getByText("Step 1 of 8")).toBeVisible();
  const prev = page.getByRole("button", { name: "Previous step" });
  const next = page.getByRole("button", { name: "Next step" });
  await expect(prev).toBeDisabled();
  await next.click();
  await expect(page.getByText("Step 2 of 8")).toBeVisible();
  await expect(prev).toBeEnabled();
  for (let i = 2; i < 8; i++) await next.click();
  await expect(page.getByText("Step 8 of 8")).toBeVisible();
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Show all" }).click();
  await expect(page.getByRole("button", { name: "Start walkthrough" })).toBeVisible();

  await page.getByRole("button", { name: /^etcd / }).click();
  await expect(page.getByText(/consistent key-value store/)).toBeVisible();
});

test("pods lab completes only when the broken Pod is deleted", async ({ page }) => {
  await page.goto("/chapters/pods");
  const lab = page.getByRole("region", { name: /Lab:/ });
  await command(page, "kubectl delete pod api");
  await expect(lab.getByRole("log")).toContainText('pod "api" deleted');
  await expect(lab.getByText("○ The api Pod still exists.")).toBeVisible();
  await expect(lab.getByText("Lab complete.")).toHaveCount(0);

  await lab.getByRole("button", { name: "Reset lab" }).click();
  for (const c of ["kubectl get pods", "kubectl describe pod broken-pod", "kubectl delete pod broken-pod"]) await command(page, c);
  for (const o of ["The failing Pod broken-pod is deleted.", "The api Pod still exists.", "The worker Pod still exists."]) {
    await expect(lab.getByText(`✓ ${o}`)).toBeVisible();
  }
  await expect(lab.getByText("Lab complete.")).toBeVisible();
});

test("replicasets lab completes", async ({ page }) => {
  await page.goto("/chapters/replicasets");
  const lab = page.getByRole("region", { name: /Lab:/ });
  await command(page, "kubectl scale replicaset frontend --replicas=5");
  await command(page, "kubectl get pods");
  await expect(lab.getByText("✓ 5 Pods owned by frontend are ready.")).toBeVisible();
  await expect(lab.getByText("Lab complete.")).toBeVisible();
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
  const pods = page.getByRole("button", { name: /^Pod / });
  await expect(pods).toHaveCount(3);
  await page.getByRole("button", { name: /toolbox/ }).click();
  await expect(page.getByText(/Controlled By:\s+<none>/)).toBeVisible();

  await command(page, "kubectl delete pod toolbox");
  await expect(pods).toHaveCount(2);
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
  await expect(quiz.getByText("0 of 22 answered.")).toBeVisible();
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
