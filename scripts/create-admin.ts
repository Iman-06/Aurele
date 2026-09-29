import "dotenv/config";
import readline from "node:readline";
import { db } from "@/lib/db";
import { MIN_PASSWORD_LENGTH, upsertAdmin } from "@/server/auth/admin-accounts";
import { DomainError } from "@/server/errors";

// npm run admin:create
// Creates the owner's admin login, or resets the password if the email already exists
// (which also signs that account out on every device). Run it yourself in a terminal —
// the password is typed here and never shown or stored in plain text.

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Print the question, then swallow the typed characters.
      const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
      out._writeToOutput = (s: string) => {
        if (s.includes(question)) out.output.write(s);
        else if (s === "\r\n" || s === "\n") out.output.write("\n");
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  if (!process.stdin.isTTY) {
    console.error("Please run this in an interactive terminal: npm run admin:create");
    process.exitCode = 1;
    return;
  }
  console.log("Lunara — create or reset an admin login\n");
  const email = (await ask("Email: ")).trim();
  const name = (await ask("Name (optional): ")).trim();
  const password = await ask(`Password (min ${MIN_PASSWORD_LENGTH} characters, letters + numbers): `, true);
  const confirm = await ask("Repeat password: ", true);
  if (password !== confirm) {
    console.error("\nPasswords don't match — nothing changed.");
    process.exitCode = 1;
    return;
  }
  try {
    const { admin, created } = await upsertAdmin(db, { email, password, name: name || undefined });
    console.log(
      created
        ? `\n✔ Admin created: ${admin.email}. Sign in at /admin/login`
        : `\n✔ Password reset for ${admin.email}. All their devices have been signed out.`,
    );
  } catch (e) {
    if (e instanceof DomainError) {
      console.error(`\n✘ ${e.message} — nothing changed.`);
      process.exitCode = 1;
    } else throw e;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
