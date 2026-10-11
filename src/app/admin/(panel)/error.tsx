"use client"; // Error boundaries must be Client Components

import { AdminErrorView } from "@/components/admin/admin-error-view";

// A page inside the admin failed (header and menu stay). "Try again" re-fetches the page's data.
export default function AdminPageError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <AdminErrorView {...props} />;
}
