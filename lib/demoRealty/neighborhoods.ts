/**
 * Los Angeles showcase neighborhoods for /realestatewebsitedemo.
 * Anchor streets are real/geocodable so School Explorer resolves correctly.
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
};

export const neighborhoods: DemoNeighborhood[] = [
  {
    slug: "hollywood-hills-ca",
    canonicalName: "Hollywood Hills, CA",
    shortLabel: "Hollywood Hills",
    metaDescription:
      "Explore Hollywood Hills, CA — hillside living with Dream Neighborhood School Explorer popup + embed for nearby school ratings.",
    anchorStreet: "2000 N Fuller Ave",
    anchorLocality: "Los Angeles",
    anchorRegion: "CA",
    anchorPostalCode: "90046",
    cardImage: "/realestatewebsitedemo/neighborhoods/hollywood-hills.jpg",
    description: [
      "Hollywood Hills drapes across the Santa Monica Mountains above the city grid, where winding roads, mid-century architecture, and sudden canyon views make every showing feel cinematic. Buyers come for privacy and elevation; they stay for Runyon-adjacent mornings and quick drops into the studios when work calls.",
      "The market here is rarely one-size-fits-all: hillside lots, view premiums, and retrofit-friendly pads each tell a different story. Pair every tour with school context so offers are grounded in the block, not just the zip.",
      "This page showcases both the School Explorer floating popup and the inline embed — the same free tools realtors add to neighborhood pages with one line of code.",
    ],
  },
  {
    slug: "silver-lake-los-angeles-ca",
    canonicalName: "Silver Lake, Los Angeles, CA",
    shortLabel: "Silver Lake",
    metaDescription:
      "Silver Lake, Los Angeles — reservoir walks and a creative mix. Explore nearby schools with popup + embedded School Explorer.",
    anchorStreet: "2300 Griffith Park Blvd",
    anchorLocality: "Los Angeles",
    anchorRegion: "CA",
    anchorPostalCode: "90039",
    cardImage: "/realestatewebsitedemo/neighborhoods/silver-lake.jpg",
    description: [
      "Silver Lake balances reservoir laps with vinyl-lined evenings: the neighborhood rewards pedestrians and curiosity while keeping DTLA or Glendale within a sane commute. Architecture ranges from 1920s Spanish revival to crisp new infill.",
      "Food and small retail cluster along Sunset and Hyperion, while quieter blocks north of the reservoir trade a little buzz for tree cover. We help clients read those tradeoffs — including which schools serve which streets.",
      "Use the School Explorer popup or the embedded panel below to compare ratings near this Silver Lake anchor address.",
    ],
  },
  {
    slug: "santa-monica-ca",
    canonicalName: "Santa Monica, CA",
    shortLabel: "Santa Monica",
    metaDescription:
      "Santa Monica, CA — beach-city living. Dive into nearby school ratings with Dream Neighborhood School Explorer.",
    anchorStreet: "1400 Santa Monica Blvd",
    anchorLocality: "Santa Monica",
    anchorRegion: "CA",
    anchorPostalCode: "90404",
    cardImage: "/realestatewebsitedemo/neighborhoods/santa-monica.jpg",
    description: [
      "Santa Monica compresses ocean air, tech-adjacent employers, and some of the Westside's most debated zoning conversations into a few coastal square miles. Buyers expect a briefing that matches that complexity — including schools.",
      "From Montana Avenue's retail calm to Pico's denser corridors, each micro-band carries different traffic and school catchment realities. We treat those deltas as first-class data, not footnotes.",
      "The School Explorer on this page is anchored in Santa Monica so you can try both the corner popup and the full-width embed.",
    ],
  },
];

export function getNeighborhoodBySlug(slug: string): DemoNeighborhood | null {
  return neighborhoods.find((n) => n.slug === slug) ?? null;
}

export function neighborhoodAnchorAddress(n: DemoNeighborhood): string {
  return `${n.anchorStreet}, ${n.anchorLocality}, ${n.anchorRegion} ${n.anchorPostalCode}`;
}
