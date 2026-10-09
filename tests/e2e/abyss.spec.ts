import { test, expect } from "@playwright/test";
import {
  createRun,
  beginBlind,
  addJoker,
  makeOffer,
  newProfile,
} from "../../client/src/abyss/engine/run.ts";
import { serialize, KEY } from "../../client/src/abyss/storage/save.ts";
import type { Run } from "../../client/src/abyss/engine/types.ts";

async function load(page: any, run: Run, animation = "instant") {
  const profile = newProfile();
  profile.settings.animation = animation as any;
  const text = serialize(run, profile);
  await page.addInitScript(
    ({ key, text }: any) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, text);
    },
    { key: KEY, text },
  );
  await page.goto("/");
  await page.locator("#continue-run").click();
}
async function state(page: any) {
  return page.evaluate(
    (key: string) => JSON.parse(JSON.parse(localStorage.getItem(key)!).payload),
    KEY,
  );
}

test("Abyss menu, collection, all settings, play/discard, reload and exact score", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Joker's");
  for (const panel of [
    "collection",
    "achievements",
    "stats",
    "saves",
    "help",
  ]) {
    await page.locator(`[data-panel="${panel}"]`).click();
    await expect(page.locator("#dialog")).toBeVisible();
    if (panel === "collection")
      await expect(page.locator(".collection-card")).toHaveCount(36);
    if (panel === "achievements")
      await expect(page.locator(".collection-card")).toHaveCount(32);
    await page.locator("#close-dialog").click();
  }
  await page.locator('[data-panel="settings"]').click();
  await page.locator("#animation").selectOption("instant");
  await page.locator("#setting-contrast").check();
  await page.locator("#save-settings").click();
  await page.locator("#seed").fill("E2E-ABYSS");
  await page.locator("#new-run").click();
  await page.locator("#begin-blind").click();
  await expect(page.locator(".hand-row [data-card]")).toHaveCount(8);
  await page.locator(".hand-row [data-card]").first().click();
  await page.locator("#discard-hand").click();
  expect((await state(page)).run.discards).toBe(2);
  await page.locator(".hand-row [data-card]").first().click();
  await page.locator("#play-hand").click();
  const saved = (await state(page)).run;
  expect(saved.lastScore.lines.at(-1).stage).toBe("Итог");
  expect(saved.stats.plays).toBe(1);
  await page.locator('[data-panel="history"]').click();
  await expect(page.locator(".score-log")).toBeVisible();
  await page.locator("#close-dialog").click();
  await page.reload();
  await page.locator("#continue-run").click();
  expect((await state(page)).run.roundScore).toBe(saved.roundScore);
  await page.locator('[data-panel="settings"]').click();
  await expect(page.locator("#animation")).toHaveValue("instant");
  await expect(page.locator("#setting-contrast")).toBeChecked();
  await page.locator("#close-dialog").click();
  await page.screenshot({
    path: `test-results/${info.project.name}-abyss-table.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("Abyss shop purchase, booster, tarot targets, joker ordering and sale", async ({
  page,
}) => {
  const r = createRun("SHOP");
  r.phase = "shop";
  r.money = 100;
  r.abyss = 15;
  addJoker(r, "spark");
  addJoker(r, "pair");
  r.shop = [
    makeOffer(r, "joker", "heart"),
    makeOffer(r, "tarot", "mult"),
    makeOffer(r, "planet", "pair"),
    makeOffer(r, "booster", "celestial"),
    makeOffer(r, "voucher", "hand"),
  ];
  await load(page, r);
  const initial = (await state(page)).run;
  await page.locator(`[data-buy="${r.shop[0].id}"]`).click();
  expect((await state(page)).run.jokers).toHaveLength(3);
  await page.locator(`[data-buy="${r.shop[1].id}"]`).click();
  await page.locator("[data-use]").first().click();
  await expect(page.locator("#apply-consumable")).toBeVisible();
  await page.locator("#dialog [data-card]").first().click();
  await page.locator("#apply-consumable").click();
  expect(
    (await state(page)).run.deck.filter((c: any) => c.enhancement === "mult"),
  ).toHaveLength(1);
  await page.locator(`[data-buy="${r.shop[2].id}"]`).click();
  await page.locator("[data-use]").first().click();
  expect((await state(page)).run.levels.pair).toBe(2);
  await page.locator(`[data-buy="${r.shop[3].id}"]`).click();
  await expect(page.locator("[data-pick]")).toHaveCount(3);
  await page.locator("[data-pick]").first().click();
  expect((await state(page)).run.phase).toBe("shop");
  await page.locator(`[data-buy="${r.shop[4].id}"]`).click();
  expect((await state(page)).run.handSize).toBe(9);
  const id = r.jokers[0].id;
  await page.locator(`[data-move="${id}"][data-direction="1"]`).click();
  expect((await state(page)).run.jokers[1].id).toBe(id);
  await page.locator(`[data-sell="${id}"]`).click();
  expect((await state(page)).run.jokers).toHaveLength(2);
  expect((await state(page)).run.money).toBeLessThan(initial.money);
  await page.locator("#next-blind").click();
  await expect(page.locator("#begin-blind")).toBeVisible();
});

test("Abyss import rejects damage, validates restore and preserves unrelated saves", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem("neon-serpents-sentinel", "keep-me");
    if (!localStorage.getItem(key)) localStorage.setItem(key, "broken-save");
  }, KEY);
  await page.goto("/");
  await page.locator('[data-panel="saves"]').click();
  await page.locator("#import-save").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":2,"payload":"bad","checksum":"0"}'),
  });
  await expect(page.locator("#notifications")).toContainText("Импорт отклонён");
  await expect(page.locator("#confirm-import")).toHaveCount(0);
  const text = serialize(createRun("RESTORED"), newProfile());
  await page.locator("#import-save").setInputFiles({
    name: "save.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await page.locator("#confirm-import").click();
  await page.locator("#continue-run").click();
  await expect(page.locator(".seed-label")).toContainText("RESTORED");
  expect(
    await page.evaluate(() => localStorage.getItem("neon-serpents-sentinel")),
  ).toBe("keep-me");
  expect(
    await page.evaluate(
      (key) =>
        Object.keys(localStorage).some((k) => k.startsWith(key + ".corrupt.")),
      KEY,
    ),
  ).toBe(true);
  await page.reload();
  await page.locator("#continue-run").click();
  await expect(page.locator(".seed-label")).toContainText("RESTORED");
});

test("Abyss layouts at six resolutions and touch long press without selection", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.locator("#new-run").click();
  await page.locator("#begin-blind").click();
  for (const [width, height] of [
    [360, 800],
    [393, 873],
    [412, 915],
    [800, 360],
    [915, 412],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("#play-hand")).toBeVisible();
    await expect(page.locator("#discard-hand")).toBeVisible();
  }
  if (info.project.name === "android") {
    await page.setViewportSize({ width: 393, height: 851 });
    const card = page.locator(".hand-row [data-card]").first();
    await card.scrollIntoViewIfNeeded();
    const rect = (await card.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 0 },
      ],
    });
    await page.waitForTimeout(600);
    await expect(page.locator("#tooltip")).toBeVisible();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(card).toHaveAttribute("aria-pressed", "false");
    await cdp.detach();
    await card.tap();
    await expect(page.locator(".hand-row [data-card]").first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  await page.keyboard.press("Control+Shift+D");
  await expect(page.locator("#dev-add-joker")).toHaveCount(0);
});

test("Abyss all animation speeds give identical engine results", async ({
  browser,
  baseURL,
}) => {
  const results = [];
  for (const animation of ["normal", "fast", "veryfast", "instant"]) {
    const context = await browser.newContext({ baseURL });
    try {
      const page = await context.newPage();
      const r = createRun("ANIMATION");
      beginBlind(r);
      r.target = "1000000";
      addJoker(r, "echo");
      addJoker(r, "spark");
      await load(page, r, animation);
      for (const id of r.hand.slice(0, 3))
        await page.locator(`[data-card="${id}"]`).click();
      await page.locator("#play-hand").click();
      const saved = (await state(page)).run;
      results.push({
        score: saved.lastScore,
        rng: saved.rng,
        deck: saved.deck,
        money: saved.money,
      });
    } finally {
      await context.close();
    }
  }
  for (const result of results) expect(result).toEqual(results[0]);
});

test("Abyss cards reorder with mouse drag and held touch drag", async ({
  page,
}, info) => {
  const r = createRun("DRAG");
  beginBlind(r);
  await load(page, r);
  const id = r.hand[0],
    target = r.hand[1];
  if (info.project.name === "desktop")
    await page
      .locator(`[data-card="${id}"]`)
      .dragTo(page.locator(`[data-card="${target}"]`));
  else {
    const card = page.locator(`[data-card="${id}"]`);
    await card.scrollIntoViewIfNeeded();
    const rect = (await card.boundingBox())!,
      x = rect.x + rect.width / 2,
      y = rect.y + rect.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 0 }],
    });
    await page.waitForTimeout(550);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + rect.width + 7, y, id: 0 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  }
  await expect.poll(async () => (await state(page)).run.hand[1]).toBe(id);
  expect((await state(page)).run.selection).toEqual([]);
});
