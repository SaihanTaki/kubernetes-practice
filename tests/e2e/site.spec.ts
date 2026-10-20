import { expect, test, type Page } from "@playwright/test";
import { chapters, sections } from "../../content/chapters";
import { data as declarative } from "../../content/chapters/declarative.data";
import { data as deployments } from "../../content/chapters/deployments.data";

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

test("home links every chapter and the cheatsheet", async ({ page }) => {
  await page.goto("/");
  await noHorizontalOverflow(page);
  await expect(page.getByText("(coming soon)")).toHaveCount(0);
  for (const section of sections) await expect(page.getByRole("heading", { level: 2, name: section })).toBeVisible();
  for (const { title } of chapters) {
    await expect(page.getByRole("main").getByRole("link", { name: new RegExp(`^\\d\\d ${title} `) })).toBeVisible();
  }
  await page.getByRole("link", { name: /^05 Deployments / }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Deployments" })).toBeVisible();
  await page.getByRole("navigation").getByRole("link", { name: "Cheatsheet" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cheatsheet" })).toBeVisible();
});

for (const { slug, title } of chapters) {
  test(`chapter ${slug} renders`, async ({ page }) => {
    await page.goto(`/chapters/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await noHorizontalOverflow(page);
  });
}

test("architecture diagram walkthrough and details", async ({ page }) => {
  await page.goto("/chapters/architecture");
  // The page has several diagrams; this one is the only one with worker node groups.
  const d = page.getByRole("group", { name: "Worker node 1" }).locator("xpath=ancestor::div[contains(@class,'my-6')][1]");
  await d.getByRole("button", { name: "Start walkthrough" }).click();
  await expect(d.getByText("Step 1 of 6")).toBeVisible();
  const prev = d.getByRole("button", { name: "Previous step" });
  const next = d.getByRole("button", { name: "Next step" });
  await expect(prev).toBeDisabled();
  await next.click();
  await expect(d.getByText("Step 2 of 6")).toBeVisible();
  await expect(prev).toBeEnabled();
  for (let i = 2; i < 6; i++) await next.click();
  await expect(d.getByText("Step 6 of 6")).toBeVisible();
  await expect(next).toBeDisabled();
  await d.getByRole("button", { name: "Show all" }).click();
  await expect(d.getByRole("button", { name: "Start walkthrough" })).toBeVisible();

  await d.getByRole("button", { name: /^etcd / }).click();
  await expect(d.getByText(/consistent key-value store/)).toBeVisible();
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
  await page.goto("/chapters/pods");
  await command(page, "kubectl get nodes");
  const input = page.getByRole("textbox", { name: /command$/ });
  await input.press("ArrowUp");
  await expect(input).toHaveValue("kubectl get nodes");
});

test("diagram follows the cluster and shows details", async ({ page }) => {
  await page.goto("/chapters/pods");
  const lab = page.getByRole("region", { name: /Lab:/ });
  const pods = lab.getByRole("button", { name: /^Pod / });
  await expect(pods).toHaveCount(3);
  await lab.getByRole("button", { name: /worker/ }).click();
  await expect(lab.getByText(/Controlled By:\s+<none>/)).toBeVisible();

  await command(page, "kubectl delete pod worker");
  await expect(pods).toHaveCount(2);
  await expect(lab.getByText("That resource no longer exists.")).toBeVisible();
  await noHorizontalOverflow(page);
});

test("quiz gives feedback and can be retried", async ({ page }) => {
  await page.goto("/chapters/deployments");
  const quiz = page.getByRole("region", { name: "Quiz" });
  await quiz.getByRole("button", { name: "A ReplicaSet owned by the Deployment" }).click();
  await expect(quiz.getByText("Correct.")).toBeVisible();
  await expect(quiz.getByText(`question 1 / ${deployments.quiz.length}`)).toBeVisible();
  await quiz.getByRole("button", { name: "Next question" }).click();
  await quiz.getByRole("button", { name: "The Deployment drops to 2 replicas" }).click();
  await expect(quiz.getByText("Not quite.")).toBeVisible();
  await expect(quiz.getByText(/Desired state is still 3/)).toBeVisible();
  await quiz.getByRole("button", { name: "Retry quiz" }).click();
  await expect(quiz.getByText("0 answered, 0 correct")).toBeVisible();
  await expect(quiz.getByText(`question 1 / ${deployments.quiz.length}`)).toBeVisible();
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

test("theme button cycles system, light, dark and is remembered", async ({ page }) => {
  await page.goto("/");
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const button = page.getByRole("button", { name: /^Theme:/ });

  await expect(button).toHaveAccessibleName("Theme: System. Switch to Light");
  await button.click();
  await expect(button).toHaveAccessibleName("Theme: Light. Switch to Dark");
  expect(await bg()).toBe("rgb(246, 243, 236)");
  await button.click();
  await expect(button).toHaveAccessibleName("Theme: Dark. Switch to System");
  expect(await bg()).toBe("rgb(17, 20, 26)");

  await page.reload();
  await expect(button).toHaveAccessibleName("Theme: Dark. Switch to System");
  expect(await bg()).toBe("rgb(17, 20, 26)");

  await button.click();
  await page.reload();
  await expect(button).toHaveAccessibleName("Theme: System. Switch to Light");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined();
});


test("declarative lab: fix the file in the editor, then apply", async ({ page }) => {
  await page.goto("/chapters/declarative");
  const lab = page.getByRole("region", { name: /Lab:/ });
  await command(page, "kubectl apply -f web.yaml");
  await expect(lab.getByRole("log")).toContainText("selector does not match template labels");

  const fixed = declarative.labs[0].solutionFiles!["web.yaml"];
  await lab.getByLabel("Contents of web.yaml").fill(fixed);
  await command(page, "kubectl apply -f web.yaml");
  await expect(lab.getByRole("log")).toContainText("deployment.apps/web created");
  await command(page, "kubectl get pods");
  await expect(lab.getByText("Lab complete.")).toBeVisible();

  await page.getByRole("button", { name: "Reset lab" }).click();
  await expect(lab.getByLabel("Contents of web.yaml")).not.toHaveValue(fixed);
});
