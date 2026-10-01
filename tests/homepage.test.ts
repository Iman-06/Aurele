import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createPromotion,
  deletePromotion,
  getHomeContent,
  listPromotions,
  promotionState,
  saveBanner,
  updatePromotion,
} from "@/server/content/homepage";
import { GET as homeRoute } from "@/app/api/store/home/route";
import { DomainError } from "@/server/errors";
import { resetDb, testDb as db } from "./helpers/db";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const photo = () => new File([Buffer.from(PNG)], "banner.png");

async function expectInvalid(p: Promise<unknown>, message?: RegExp) {
  const e = await p.then(() => null, (x) => x);
  expect(e).toBeInstanceOf(DomainError);
  if (message) expect((e as DomainError).message).toMatch(message);
}

let mediaDir: string;
beforeAll(async () => {
  mediaDir = await mkdtemp(path.join(os.tmpdir(), "lunara-home-"));
  process.env.MEDIA_DIR = mediaDir;
});
afterAll(async () => {
  await rm(mediaDir, { recursive: true, force: true });
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb();
  for (const f of await readdir(mediaDir)) await rm(path.join(mediaDir, f)); // each test starts with no photos
});

describe("homepage banner", () => {
  it("nothing is shown until a banner with a photo is switched on", async () => {
    expect(await getHomeContent(db)).toEqual({ banner: null, promotion: null });
    await expectInvalid(saveBanner(db, { heading: "New Collection", isActive: "on" }), /Upload a banner photo/);
    expect(await readdir(mediaDir)).toEqual([]);

    await saveBanner(db, { heading: "New Collection", isActive: "" }, { image: photo() });
    expect((await getHomeContent(db)).banner).toBeNull(); // saved but switched off

    await saveBanner(db, { heading: "Lunara — Eid Edit", subheading: "Pearls & gold", buttonText: "Shop now", buttonLink: "/collections/new", isActive: "on" });
    const { banner } = await getHomeContent(db);
    expect(banner).toMatchObject({ heading: "Lunara — Eid Edit", subheading: "Pearls & gold", button: { text: "Shop now", link: "/collections/new" } });
    expect(banner!.imageUrl).toMatch(/^\/media\/.+\.png$/);
    expect(banner!.mobileImageUrl).toBe(banner!.imageUrl); // falls back to the main photo
  });

  it("replacing a photo deletes the old file; the phone photo can be removed", async () => {
    await saveBanner(db, { isActive: "on" }, { image: photo(), mobileImage: photo() });
    expect(await readdir(mediaDir)).toHaveLength(2);
    await saveBanner(db, { isActive: "on" }, { image: photo() });
    expect(await readdir(mediaDir)).toHaveLength(2); // old main photo replaced
    await saveBanner(db, { isActive: "on", removeMobileImage: "on" });
    expect(await readdir(mediaDir)).toHaveLength(1);
    const { banner } = await getHomeContent(db);
    expect(banner!.mobileImageUrl).toBe(banner!.imageUrl);
  });

  it("only safe links are accepted, and a button needs a link", async () => {
    await saveBanner(db, { isActive: "" }, { image: photo() });
    for (const bad of ["javascript:alert(1)", "//evil.example", "data:text/html,hi", "ftp://x.example"]) {
      await expectInvalid(saveBanner(db, { buttonText: "Go", buttonLink: bad }), /Links must start with/);
    }
    await expectInvalid(saveBanner(db, { buttonText: "Go" }), /Add a link/);
    await saveBanner(db, { buttonText: "Instagram", buttonLink: "https://instagram.com/lunara", isActive: "on" });
    expect((await getHomeContent(db)).banner!.button).toEqual({ text: "Instagram", link: "https://instagram.com/lunara" });
  });
});

describe("promotions", () => {
  const now = new Date("2026-10-10T12:00:00+05:00");

  it("states: live, scheduled, ended, off", () => {
    const at = (s: string) => new Date(`${s}+05:00`);
    expect(promotionState({ isActive: true, startsAt: null, endsAt: null }, now)).toBe("LIVE");
    expect(promotionState({ isActive: true, startsAt: at("2026-10-11T00:00:00"), endsAt: null }, now)).toBe("SCHEDULED");
    expect(promotionState({ isActive: true, startsAt: null, endsAt: at("2026-10-10T12:00:00") }, now)).toBe("ENDED");
    expect(promotionState({ isActive: false, startsAt: null, endsAt: null }, now)).toBe("OFF");
  });

  it("dates from the date picker are Pakistan time; the end must be after the start", async () => {
    const p = await createPromotion(db, { title: "Eid Sale — 20% off", isActive: "on", startsAt: "2026-10-15T09:00", endsAt: "2026-10-20" });
    expect(p.startsAt!.toISOString()).toBe("2026-10-15T04:00:00.000Z");
    expect(p.endsAt!.toISOString()).toBe("2026-10-19T19:00:00.000Z"); // 20 Oct 00:00 PKT
    await expectInvalid(createPromotion(db, { title: "Bad", startsAt: "2026-10-20T10:00", endsAt: "2026-10-20T09:00" }), /end must be after/);
    await expectInvalid(createPromotion(db, { title: "Bad", startsAt: "next friday" }), /date picker/);
    await expectInvalid(createPromotion(db, { title: "" }), /headline/);
    await expectInvalid(createPromotion(db, { title: "Bad link", linkText: "Shop", linkUrl: "javascript:x" }), /Links must start/);
  });

  it("the storefront gets the live promotion; scheduled and ended ones wait/disappear by themselves", async () => {
    await createPromotion(db, { title: "Always-on free gift wrap", isActive: "on" });
    await createPromotion(db, { title: "Eid Sale", details: "20% off earrings", linkText: "Shop the sale", linkUrl: "/sale", isActive: "on", startsAt: "2026-10-15T00:00", endsAt: "2026-10-20T00:00" });
    await createPromotion(db, { title: "Old sale", isActive: "on", endsAt: "2026-10-01T00:00" });
    await createPromotion(db, { title: "Switched off", isActive: "" });

    const before = await getHomeContent(db, new Date("2026-10-10T12:00:00+05:00"));
    expect(before.promotion?.title).toBe("Always-on free gift wrap");

    const during = await getHomeContent(db, new Date("2026-10-16T12:00:00+05:00"));
    expect(during.promotion).toEqual({
      title: "Eid Sale",
      details: "20% off earrings",
      link: { text: "Shop the sale", url: "/sale" },
      url: "/sale",
      endsAt: "2026-10-19T19:00:00.000Z",
    }); // the scheduled one wins while it runs

    const after = await getHomeContent(db, new Date("2026-10-21T12:00:00+05:00"));
    expect(after.promotion?.title).toBe("Always-on free gift wrap");

    const list = await listPromotions(db, new Date("2026-10-10T12:00:00+05:00"));
    expect(list.map((p) => [p.title, p.state])).toEqual([
      ["Always-on free gift wrap", "LIVE"],
      ["Eid Sale", "SCHEDULED"],
      ["Switched off", "OFF"],
      ["Old sale", "ENDED"],
    ]);
  });

  it("edit, switch off and delete", async () => {
    const p = await createPromotion(db, { title: "Gift wrap", isActive: "on" });
    await updatePromotion(db, p.id, { title: "Free gift wrap this week", isActive: "" });
    expect((await getHomeContent(db)).promotion).toBeNull();
    await deletePromotion(db, p.id);
    expect(await db.promotion.count()).toBe(0);
    await expectInvalid(deletePromotion(db, p.id));
    await expectInvalid(updatePromotion(db, 999, { title: "x y" }));
  });

  it("GET /api/store/home returns the content", async () => {
    await createPromotion(db, { title: "Free shipping over Rs 5,000", isActive: "on" });
    const res = await homeRoute();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ banner: null, promotion: { title: "Free shipping over Rs 5,000", link: null, url: null } });
  });
});
