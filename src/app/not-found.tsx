import Link from "next/link";
import { Wordmark } from "@/components/store/brand-mark";
import { cardo, petrona } from "@/lib/fonts";
import { BRAND_NAME } from "@/lib/storefront";

export default function NotFound() {
  return (
    <div className={`${cardo.variable} ${petrona.variable} ${cardo.className} flex min-h-full flex-1 flex-col bg-white text-[#1c1c1c]`}>
      <header className="border-b border-[#e6e6e6]">
        <div className="mx-auto flex h-[4.5rem] items-center px-4 sm:px-8">
          <Link href="/" aria-label={BRAND_NAME}>
            <Wordmark variant="dark" crop="word" className="h-8" />
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-normal">Page not found</h1>
        <p className="mt-4 text-sm text-[#6b6b6b]">That address isn’t on the shop.</p>
        <Link href="/" className="btn btn-add mt-8">
          Back to the shop
        </Link>
      </main>
    </div>
  );
}
