"use client"; // Error boundaries must be Client Components

import { AdminErrorView } from "@/components/admin/admin-error-view";

// The admin layout itself failed — usually the database couldn't be reached while checking the
// login. There is no header here (it's part of what failed), so keep it simple and centred.
export default function AdminLayoutError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <AdminErrorView {...props} />
    </div>
  );
}
