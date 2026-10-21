import Link from "next/link";

export default function StoreNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-normal">Page not found</h1>
      <p className="mt-4 text-sm text-muted">That address isn’t on the shop.</p>
      <Link href="/" className="btn btn-add mt-8">
        Back to the shop
      </Link>
    </main>
  );
}
