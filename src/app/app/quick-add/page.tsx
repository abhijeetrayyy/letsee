import { redirect } from "next/navigation";
import { getAuthUserId } from "@/utils/apiAuth";
import QuickAddClient from "./QuickAddClient";

export const dynamic = "force-dynamic";

export const metadata = {
  // No index: it redirects to /login when signed out, so a crawler only ever sees a redirect
  // or a form it cannot use.
  robots: { index: false, follow: false },
  // The root layout appends the brand; this was rendering "Quick add — LetSee · LetSee".
  title: "Quick add",
  description: "Log everything you've seen in a couple of minutes.",
};

export default async function QuickAddPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  if (!(await getAuthUserId())) redirect("/login");

  const { type } = await searchParams;

  return (
    <div className="min-h-screen bg-page">
      <QuickAddClient initialType={type === "tv" ? "tv" : "movie"} />
    </div>
  );
}
