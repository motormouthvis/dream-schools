import { HomeExplorer } from "@/components/HomeExplorer";

export const metadata = {
  title: "School Explorer — Free for Parents & Home Buyers",
  description:
    "See real school ratings, test scores, college readiness, and safety for any address or neighborhood — instantly and free.",
};

// Parent-only view: same hero + search + Parents section as the home page, but
// with the Realtor and Partner sections hidden and no navigation away.
//
// This is where Dream Neighborhood's "See Details" links land, as
// /parents?address=…&school=<ncesId>. Reading those here rather than on the
// client is what stops the landing page flashing before the school appears: the
// server renders the loading state directly, so the first paint is already the
// right screen. Doing it in an effect meant the hero and search box were
// painted for the whole length of the lookup.
function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) || "";
}

export default async function ParentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <HomeExplorer
      variant="parents"
      deepLink={{ address: one(sp.address), school: one(sp.school) }}
    />
  );
}
