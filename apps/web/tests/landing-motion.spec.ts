import { expect, test } from "@playwright/test";

test("purchase card blends materials and replaces its print without stale rapid updates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const steps = page.getByRole("group", { name: "Purchase workflow steps" });
  await steps
    .getByRole("button", { name: /Fund a Purchase Pass/ })
    .scrollIntoViewIfNeeded();
  const detail = page.getByRole("region", {
    name: "Purchase lifecycle illustration",
    exact: true,
  });
  const card = detail.locator("[data-stage]");
  const print = detail.locator("[data-text-phase]");
  await expect(detail.locator("[data-story-object]")).toHaveAttribute(
    "style",
    /transform/,
  );
  await expect(print).toHaveAttribute("data-text-phase", "0");
  await expect(card).toHaveCSS("background-color", "rgb(81, 231, 156)");
  const transform = await card.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await steps
    .getByRole("button", { name: /Give your agent the brief/ })
    .dispatchEvent("click");
  await expect(print).toHaveAttribute("data-text-transition", /out|in/);
  await expect(print).toHaveAttribute("data-text-phase", "1");
  await expect(print).toHaveAttribute("data-text-transition", "idle");
  await expect(card).toHaveCSS("background-color", "rgb(222, 233, 226)");
  await expect
    .poll(() => card.evaluate((element) => getComputedStyle(element).transform))
    .toBe(transform);
  await steps
    .getByRole("button", { name: /Fund a Purchase Pass/ })
    .dispatchEvent("click");
  await page.waitForTimeout(35);
  await steps
    .getByRole("button", { name: /Your policy. Your payment/ })
    .dispatchEvent("click");
  await page.waitForTimeout(35);
  await steps
    .getByRole("button", { name: /Give your agent the brief/ })
    .dispatchEvent("click");
  await expect(print).toHaveAttribute("data-text-phase", "1");
  await expect(print).toHaveAttribute("data-text-transition", "idle");
  await page.waitForTimeout(450);
  await expect(print).toHaveAttribute("data-text-phase", "1");
  await expect(print).toHaveCSS("opacity", "1");
});

test("reduced motion settles a changing purchase card immediately", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const steps = page.getByRole("group", { name: "Purchase workflow steps" });
  const detail = page.getByRole("region", {
    name: "Purchase lifecycle illustration",
    exact: true,
  });
  const print = detail.locator("[data-text-phase]");
  await steps
    .getByRole("button", { name: /Give your agent the brief/ })
    .dispatchEvent("click");
  await expect(print).toHaveAttribute("data-text-phase", "1");
  await expect(print).toHaveAttribute("data-text-transition", "idle");
  await expect(print).toHaveCSS("opacity", "1");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await steps
    .getByRole("button", { name: /Fund a Purchase Pass/ })
    .dispatchEvent("click");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(print).toHaveAttribute("data-text-phase", "0");
  await expect(print).toHaveAttribute("data-text-transition", "idle");
  await expect(print).toHaveCSS("opacity", "1");
});

test("mobile stages place the matching illustration beside the selected chapter", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const brief = page.getByRole("button", { name: /Give your agent the brief/ });
  await brief.click();
  const privateView = page.getByRole("region", {
    name: "Give your agent the brief illustration",
  });
  await expect(privateView).toBeVisible();
  await expect(
    privateView.getByText("notebooks", { exact: true }),
  ).toBeVisible();
  await expect(brief.locator("..").getByRole("region")).toContainText(
    "PRIVATE DELIVERY",
  );
  await page
    .getByRole("button", { name: /Your policy. Your payment/ })
    .click();
  const receipt = page.getByRole("region", {
    name: "Your policy. Your payment. illustration",
  });
  await expect(
    receipt.getByRole("link", { name: "View transaction" }),
  ).toBeVisible();
  await expect(privateView).toBeHidden();
});

test("WebGL scene draws, pauses, and changes geometry through explicit controls", async ({
  page,
}) => {
  await page.goto("/");
  const scene = page.locator(
    '[aria-label="Interactive 3D purchase lifecycle illustration"]',
  );
  await expect(scene).toHaveAttribute("data-webgl", "ready");
  await page.getByRole("button", { name: "Pause 3D motion" }).click();
  const canvas = scene.locator("canvas");
  const pausedFrame = await canvas.screenshot();
  await page.waitForTimeout(350);
  expect((await canvas.screenshot()).equals(pausedFrame)).toBe(true);
  await page
    .getByRole("button", { name: "Show private result", exact: true })
    .click();
  await expect(scene).toContainText("02 / Private result");
  expect((await canvas.screenshot()).equals(pausedFrame)).toBe(false);
  await expect(
    page.getByRole("button", { name: "Play 3D motion" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show payment receipt", exact: true })
    .click();
  await expect(scene).toContainText("03 / Payment record");
});

test("scroll chapters reverse correctly and the physical pass responds to pointer tilt", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const review = page.getByRole("button", {
    name: /Your policy. Your payment/,
  });
  await review.scrollIntoViewIfNeeded();
  await expect(review).toHaveAttribute("aria-pressed", "true");
  const detail = page.getByRole("region", {
    name: "Purchase lifecycle illustration",
  });
  await expect(
    detail.getByRole("link", { name: "View transaction" }),
  ).toBeVisible();
  const brief = page.getByRole("button", { name: /Give your agent the brief/ });
  await brief.scrollIntoViewIfNeeded();
  await expect(brief).toHaveAttribute("aria-pressed", "true");
  await expect(detail).toContainText("Illustrative extraction example");
  const object = detail.locator('[data-object-stage="1"]');
  const card = object.locator('[data-stage="1"]');
  const before = await card.evaluate((el) => getComputedStyle(el).transform);
  const box = await object.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.8, box!.y + box!.height * 0.4);
  await expect
    .poll(() => card.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe(before);
  const first = page
    .getByRole("group", { name: "Purchase workflow steps" })
    .getByRole("button", { name: /Fund a Purchase Pass/ });
  await first.scrollIntoViewIfNeeded();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(detail).toContainText("Separate storage budget");
});

test("context loss and live reduced-motion switching leave a readable fallback", async ({
  page,
}) => {
  await page.goto("/");
  const scene = page.locator(
    '[aria-label="Interactive 3D purchase lifecycle illustration"]',
  );
  await expect(scene).toHaveAttribute("data-webgl", "ready");
  const loss = await scene
    .locator("canvas")
    .evaluateHandle((canvas: HTMLCanvasElement) => {
      const extension = canvas
        .getContext("webgl")
        ?.getExtension("WEBGL_lose_context");
      if (!extension)
        throw new Error("Context-loss test extension unavailable");
      return extension;
    });
  await loss.evaluate((extension) => extension.loseContext());
  await expect(scene).not.toHaveAttribute("data-webgl");
  await expect(scene.locator("img")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(scene).not.toHaveAttribute("data-webgl");
  await loss.evaluate((extension) => extension.restoreContext());
  await page.waitForFunction(
    () =>
      document.querySelector("canvas")?.getContext("webgl")?.isContextLost() ===
      false,
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(scene).toHaveAttribute("data-webgl", "ready");
  await page.getByRole("link", { name: "Open app", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Connect to continue" }),
  ).toBeVisible();
  await expect(page.locator("[data-webgl]")).toHaveCount(0);
  await page.goBack();
  await expect(scene).toHaveAttribute("data-webgl", "ready");
  await expect(scene.locator("canvas")).toHaveCount(1);
});
