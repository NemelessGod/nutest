import { test, expect } from "@playwright/test";
test("lobby, all panels, persisted settings and authoritative flight", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/serpents.html");
  await expect(page.locator("#nickname")).toHaveValue("Пилот");
  await page.locator("#nickname").fill("QA Pilot");
  await page.locator('[data-class="phantom"]').click();
  await page.locator('[data-skin="violet"]').click();
  await expect(page.locator('[data-skin="violet"]')).toHaveClass(/active/);
  for (const panel of [
    "garage",
    "quests",
    "achievements",
    "records",
    "account",
  ]) {
    await page.locator(`[data-panel="${panel}"]`).click();
    await expect(page.locator("#modal")).toBeVisible();
    await page.locator("#modal-close").click();
    await expect(page.locator("#modal")).toBeHidden();
  }
  await page.locator("#settings-open").click();
  await page.locator("#quality").selectOption("medium");
  await page.locator("#save-settings").click();
  await page.locator("#ability-first").selectOption("magnet");
  await page.locator("#play").click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#leaders li")).toHaveCount(10);
  if (info.project.name === "android") {
    await expect(page.locator("#joystick")).toBeVisible();
    const rect = await page.locator("#joystick").boundingBox();
    const boostRect = await page.locator("#touch-boost").boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: rect.x + 80, y: rect.y + 50, id: 0 },
        { x: boostRect.x + 35, y: boostRect.y + 35, id: 1 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: rect.x + 90, y: rect.y + 30, id: 0 },
        { x: boostRect.x + 35, y: boostRect.y + 35, id: 1 },
      ],
    });
    await expect(page.locator("#joystick-knob")).toHaveAttribute(
      "style",
      /translate/,
    );
    await page.waitForTimeout(300);
    await expect(page.locator("#energy-value")).not.toHaveText("100");
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
    await expect(page.locator("#touch-boost")).toBeVisible();
  } else {
    await page.mouse.move(950, 450);
    await page.keyboard.down("Space");
    await page.waitForTimeout(300);
    await page.keyboard.up("Space");
    await expect(page.locator("#energy-value")).not.toHaveText("100");
  }
  await page.locator('[data-ability="0"]').click();
  await expect(page.locator('[data-ability="0"] .cooldown')).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-arena.png`,
  });
  await page.locator("#pause").click();
  await page.locator("#leave-arena").click();
  await expect(page.locator("#lobby")).toBeVisible();
  await page.reload();
  await expect(page.locator("#nickname")).toHaveValue("QA Pilot");
  await page.locator("#settings-open").click();
  await expect(page.locator("#quality")).toHaveValue("medium");
  expect(errors).toEqual([]);
});
test("account registration, returning login and layout at both orientations", async ({
  page,
}, info) => {
  await page.goto("/serpents.html");
  await expect(page.locator("#nickname")).toHaveValue("Пилот");
  await page.locator('[data-panel="account"]').click();
  const username = "qa_" + Date.now();
  await page.locator("#username").fill(username);
  await page.locator("#password").fill("safe-test-password");
  await page.locator("#register").click();
  await expect(page.locator("#modal")).toBeHidden();
  await page.locator('[data-panel="account"]').click();
  await expect(page.locator("#modal-body h2")).toHaveText("Ваш аккаунт");
  await page.locator("#logout").click();
  await expect(page.locator("#modal-body h2")).toHaveText(
    "Сохраните свой позывной",
  );
  await page.locator("#username").fill(username);
  await page.locator("#password").fill("safe-test-password");
  await page.locator("#login").click();
  await expect(page.locator("#modal")).toBeHidden();
  if (info.project.name === "android") {
    for (const viewport of [
      { width: 412, height: 915 },
      { width: 915, height: 412 },
    ]) {
      await page.setViewportSize(viewport);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await expect(page.locator("#play")).toBeVisible();
    }
  }
  await page.screenshot({
    path: `test-results/${info.project.name}-lobby.png`,
  });
});
test("two independent browsers join the same server arena", async ({
  browser,
  baseURL,
}) => {
  const c1 = await browser.newContext(),
    c2 = await browser.newContext();
  try {
    const p1 = await c1.newPage(),
      p2 = await c2.newPage();
    await Promise.all([
      p1.goto(baseURL + "/serpents.html"),
      p2.goto(baseURL + "/serpents.html"),
    ]);
    await expect(p1.locator("#nickname")).toHaveValue("Пилот");
    await expect(p2.locator("#nickname")).toHaveValue("Пилот");
    await p1.locator("#play").click();
    await p2.locator("#play").click();
    await expect(p1.locator("#hud")).toBeVisible();
    await expect(p2.locator("#hud")).toBeVisible();
    expect(await p1.locator("#room-label").textContent()).toEqual(
      await p2.locator("#room-label").textContent(),
    );
    const health = await (await p1.request.get("/api/health")).json();
    expect(health.players).toBeGreaterThanOrEqual(2);
  } finally {
    await c1.close();
    await c2.close();
  }
});
