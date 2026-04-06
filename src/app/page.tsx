import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import HomeClientPage from "./page.client";

export default async function HomePage() {
  try {
    await requireUser();
  } catch {
    redirect("/auth");
  }

  return <HomeClientPage />;
}
