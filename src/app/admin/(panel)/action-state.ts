import { DomainError } from "@/server/errors";

// Result of an admin Server Action, shown next to the form by <ActionForm>.
export type ActionState = { message?: string; error?: string } | null;

/** Run an admin mutation: DomainErrors become a friendly message; anything else is logged. */
export async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await fn();
    return { message: message ?? "Saved" };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    // redirect()/notFound() work by throwing — let Next.js handle those.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { error: "Something went wrong. Please try again." };
  }
}
