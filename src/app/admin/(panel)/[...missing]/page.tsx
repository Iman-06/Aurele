import { notFound } from "next/navigation";

// Any /admin/... address that isn't a real admin page → the admin "page not found"
// (inside the admin layout) instead of the website's 404.
export default function MissingAdminPage() {
  notFound();
}
