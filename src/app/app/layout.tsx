/**
 * The app's pages. Their providers (SWR, preferences, interactions) and the
 * toaster moved to the root layout, which also holds the bars: Log it in the
 * bars needs the same preferences as the page beneath it.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full flex flex-col justify-center bg-page text-ink-300">
      <div className="w-full flex flex-col min-h-screen">
        <div className="grow">{children}</div>
        {/* No footer on app pages; its credit lives in the account menu (PAGES.md §0). */}
      </div>
    </div>
  );
}
