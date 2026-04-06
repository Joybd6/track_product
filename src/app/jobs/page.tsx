import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import JobsClientPage from "./page.client";

export default async function JobsPage() {
  try {
    await requireUser();
  } catch {
    redirect("/auth");
  }

  return <JobsClientPage />;
}
