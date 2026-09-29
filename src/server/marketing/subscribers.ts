import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "../errors";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Please enter a valid email address"));

/** Mailing list sign-up. Signing up twice is fine (no error, no duplicate). */
export async function subscribe(db: PrismaClient, rawEmail: unknown) {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) throw new DomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid email");
  await db.subscriber.upsert({ where: { email: parsed.data }, create: { email: parsed.data }, update: {} });
}
