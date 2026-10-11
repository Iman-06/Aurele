// Shown inside the admin layout (header + menu stay put) while a page's data loads —
// mostly noticeable on phone data.
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-48 animate-pulse bg-[#efefef]" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse border border-[#e6e6e6] bg-[#f7f7f7]" />
        ))}
      </div>
    </div>
  );
}
