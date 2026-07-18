/**
 * Los Angeles showcase neighborhoods for /realestatewebsitedemo.
 * Anchor streets are real/geocodable so School Explorer resolves correctly.
 *
 * explorerMode:
 *   - "popup" — floating corner explorer only (like listing pages)
 *   - "embed" — inline explorer on the page (no floating popup)
 */
export type DemoNeighborhood = {
  slug: string;
  canonicalName: string;
  shortLabel: string;
  metaDescription: string;
  anchorStreet: string;
  anchorLocality: string;
  anchorRegion: string;
  anchorPostalCode: string;
  cardImage: string;
  description: string[];
  explorerMode: "popup" | "embed";
};

export const neighborhoods: DemoNeighborhood[] = [
  {
    slug: "hollywood-hills-ca",
    canonicalName: "Hollywood Hills, CA",
    shortLabel: "Hollywood Hills",
    metaDescription:
      "Hollywood Hills real estate — hillside living, canyon views, and school ratings for every block.",
    anchorStreet: "2000 N Fuller Ave",
    anchorLocality: "Los Angeles",
    anchorRegion: "CA",
    anchorPostalCode: "90046",
    cardImage: "/realestatewebsitedemo/neighborhoods/hollywood-hills.jpg",
    explorerMode: "embed",
    description: [
      "Hollywood Hills drapes across the Santa Monica Mountains above the city grid, where winding roads, mid-century architecture, and sudden canyon views make every showing feel cinematic. Buyers come for privacy and elevation; they stay for Runyon-adjacent mornings and quick drops into the studios when work calls.",
      "The market here is rarely one-size-fits-all: hillside lots, view premiums, and retrofit-friendly pads each tell a different story. We pair every tour with clear school context so offers are grounded in the block, not just the zip.",
      "From Mulholland ridges to quieter canyon pockets, DN Realty helps you weigh lifestyle, commute, and schools before you write an offer.",
    ],
  },
  {
    slug: "santa-monica-ca",
    canonicalName: "Santa Monica, CA",
    shortLabel: "Santa Monica",
    metaDescription:
      "Santa Monica real estate — beach-city living with strong schools and a walkable Westside lifestyle.",
    anchorStreet: "1400 Santa Monica Blvd",
    anchorLocality: "Santa Monica",
    anchorRegion: "CA",
    anchorPostalCode: "90404",
    cardImage: "/realestatewebsitedemo/neighborhoods/santa-monica.jpg",
    explorerMode: "embed",
    description: [
      "Santa Monica compresses ocean air, tech-adjacent employers, and some of the Westside's most debated zoning conversations into a few coastal square miles. Buyers expect a briefing that matches that complexity — including schools.",
      "From Montana Avenue's retail calm to Pico's denser corridors, each micro-band carries different traffic and school catchment realities. We treat those deltas as first-class data, not footnotes.",
      "Whether you are drawn to the beach, Expo access, or a quieter residential street, we help you see the full neighborhood picture before you tour.",
    ],
  },
  {
    slug: "silver-lake-los-angeles-ca",
    canonicalName: "Silver Lake, Los Angeles, CA",
    shortLabel: "Silver Lake",
    metaDescription:
      "Silver Lake real estate — reservoir walks, creative energy, and schools that matter to families and first-time buyers.",
    anchorStreet: "2300 Griffith Park Blvd",
    anchorLocality: "Los Angeles",
    anchorRegion: "CA",
    anchorPostalCode: "90039",
    cardImage: "/realestatewebsitedemo/neighborhoods/silver-lake.jpg",
    explorerMode: "popup",
    description: [
      "Silver Lake balances reservoir laps with vinyl-lined evenings: the neighborhood rewards pedestrians and curiosity while keeping DTLA or Glendale within a sane commute. Architecture ranges from 1920s Spanish revival to crisp new infill.",
      "Food and small retail cluster along Sunset and Hyperion, while quieter blocks north of the reservoir trade a little buzz for tree cover. We help clients read those tradeoffs — including which schools serve which streets.",
      "Looking at Silver Lake, Echo Park, or Atwater? We will help you compare lifestyle and schools without losing the plot of the home itself.",
    ],
  },
  {
    slug: "los-feliz-ca",
    canonicalName: "Los Feliz, CA",
    shortLabel: "Los Feliz",
    metaDescription:
      "Los Feliz real estate — Griffith Park at your doorstep, classic architecture, and schools for every stage of life.",
    anchorStreet: "1923 N Hillhurst Ave",
    anchorLocality: "Los Angeles",
    anchorRegion: "CA",
    anchorPostalCode: "90027",
    cardImage:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
    explorerMode: "popup",
    description: [
      "Los Feliz sits where the Hollywood Hills meet the city grid — Griffith Park trails above, Hillhurst and Vermont cafes below, and a housing stock that runs from Spanish courtyards to gated estates.",
      "Families often come for the park, the museums, and the school options; creatives stay for the light, the views, and a neighborhood that still feels like a village.",
      "We help you weigh street-by-street differences — noise, parking, school assignments — so your shortlist reflects how you will actually live here.",
    ],
  },
];

export function getNeighborhoodBySlug(slug: string): DemoNeighborhood | null {
  return neighborhoods.find((n) => n.slug === slug) ?? null;
}

export function neighborhoodAnchorAddress(n: DemoNeighborhood): string {
  return `${n.anchorStreet}, ${n.anchorLocality}, ${n.anchorRegion} ${n.anchorPostalCode}`;
}
