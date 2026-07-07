import { HomeExplorer } from "@/components/HomeExplorer";

export const metadata = {
  title: "School Explorer — Free for Parents & Home Buyers",
  description:
    "See real school ratings, test scores, college readiness, and safety for any address or neighborhood — instantly and free.",
};

// Parent-only view: same hero + search + Parents section as the home page, but
// with the Realtor and Partner sections hidden and no navigation away.
export default function ParentsPage() {
  return <HomeExplorer variant="parents" />;
}
