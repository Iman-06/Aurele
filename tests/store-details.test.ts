import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET as settingsRoute } from "@/app/api/store/settings/route";
import { updateStoreDetails } from "@/server/admin/store-details";
import { DomainError } from "@/server/errors";
import { getStoreDetails, SETTING_DEFAULTS } from "@/server/settings";
import { resetDb, testDb as db } from "./helpers/db";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const VALID = {
  announcement_text: "  Free delivery   over Rs 5,000 ",
  instagram_url: "https://www.instagram.com/aurele.pk/",
  support_email: " Hello@Aurele.PK ",
  about_blurb: "Handpicked jewellery from Lahore.",
};

describe("store details (owner-editable site text)", () => {
  it("uses the current website text until the owner saves anything", async () => {
    expect(await db.setting.count()).toBe(0);
    expect(await getStoreDetails(db)).toEqual({
      announcement: SETTING_DEFAULTS.announcement_text,
      instagramUrl: SETTING_DEFAULTS.instagram_url,
      supportEmail: null, // no support email chosen yet → hidden
      aboutBlurb: SETTING_DEFAULTS.about_blurb,
    });
  });

  it("saves tidied values and the public API returns them", async () => {
    await updateStoreDetails(db, VALID);
    const body = await (await settingsRoute()).json();
    expect(body).toMatchObject({
      shippingFee: 250,
      announcement: "Free delivery over Rs 5,000",
      instagramUrl: "https://www.instagram.com/aurele.pk/",
      supportEmail: "hello@aurele.pk",
      aboutBlurb: "Handpicked jewellery from Lahore.",
    });
  });

  it("an empty box hides that item (null), instead of falling back to the old text", async () => {
    await updateStoreDetails(db, { announcement_text: "", instagram_url: "", support_email: "", about_blurb: "  " });
    expect(await getStoreDetails(db)).toEqual({ announcement: null, instagramUrl: null, supportEmail: null, aboutBlurb: null });
  });

  it("rejects bad links, bad emails and over-long text without saving anything", async () => {
    const bad: [Partial<typeof VALID>, RegExp][] = [
      [{ instagram_url: "https://evil.example.com/aurele" }, /Instagram link/],
      [{ instagram_url: "javascript:alert(1)" }, /Instagram link/],
      [{ instagram_url: "http://instagram.com/aurele" }, /Instagram link/], // must be https
      [{ support_email: "not-an-email" }, /support email/],
      [{ announcement_text: "x".repeat(121) }, /at most 120/],
      [{ about_blurb: "x".repeat(501) }, /at most 500/],
    ];
    for (const [patch, msg] of bad) {
      const err = await updateStoreDetails(db, { ...VALID, ...patch }).catch((e) => e);
      expect(err).toBeInstanceOf(DomainError);
      expect(err.message).toMatch(msg);
    }
    expect(await db.setting.count()).toBe(0);
  });

  it("doesn't touch other settings like the shipping fee", async () => {
    await db.setting.create({ data: { key: "shipping_fee", value: "300" } });
    await updateStoreDetails(db, VALID);
    expect((await db.setting.findUniqueOrThrow({ where: { key: "shipping_fee" } })).value).toBe("300");
  });
});
