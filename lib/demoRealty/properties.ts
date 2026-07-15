/** Demo listings for /realestatewebsitedemo — real geocodable U.S. addresses (fake brokerage). */

export type DemoProperty = {
  slug: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  neighborhood: string;
  price: number;
  status: string;
  type: string;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  lotSqft: number;
  featured: boolean;
  agent: string;
  summary: string;
  description: string;
  features: string[];
  images: string[];
};

export type DemoAgent = {
  name: string;
  title: string;
  phone: string;
  email: string;
  photo: string;
};

const img = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const properties: DemoProperty[] = [
  {
    slug: "6947-oporto-drive",
    address: "6947 Oporto Drive",
    city: "Los Angeles",
    state: "CA",
    zip: "90068",
    neighborhood: "Hollywood Hills",
    price: 280000,
    status: "For Sale",
    type: "Bungalow",
    beds: 5,
    baths: 3,
    sqft: 1800,
    yearBuilt: 1962,
    lotSqft: 6200,
    featured: true,
    agent: "agent-leslie",
    summary:
      "A light-filled hillside bungalow with canyon views, an open great room, and a private terrace built for golden-hour evenings.",
    description:
      "Tucked into a quiet bend of the Hollywood Hills, 6947 Oporto Drive blends mid-century bones with a warm, contemporary refresh. The open great room flows onto a wraparound terrace with sweeping canyon views, while the chef's kitchen anchors everyday living. Three bedrooms upstairs each enjoy treetop outlooks, and the lower level offers a flexible studio for work or guests.",
    features: [
      "Canyon and city-light views",
      "Chef's kitchen with quartz island",
      "Wraparound terrace",
      "Two-car garage",
      "Smart climate and lighting",
      "Drought-tolerant landscaping",
    ],
    images: [
      img("1568605114967-8130f3a36994"),
      img("1600585154340-be6161a56a0c"),
      img("1600566753190-17f0baa2a6c3"),
    ],
  },
  {
    slug: "199-west-temple-street",
    address: "199 West Temple Street",
    city: "Los Angeles",
    state: "CA",
    zip: "90012",
    neighborhood: "Downtown LA",
    price: 950000,
    status: "For Sale",
    type: "City Townhouse",
    beds: 2,
    baths: 2,
    sqft: 1600,
    yearBuilt: 2018,
    lotSqft: 0,
    featured: true,
    agent: "agent-albert",
    summary:
      "A sleek downtown townhouse steps from the arts district, with floor-to-ceiling glass and a private rooftop lounge.",
    description:
      "Urban living at its most refined. This two-story townhouse pairs floor-to-ceiling glass with engineered oak floors and a gallery-grade lighting plan. The main level opens to a chef's kitchen and dining lounge; upstairs, a primary suite with spa bath and a second en-suite bedroom frame the skyline. Cap it off with a private rooftop lounge wired for entertaining.",
    features: [
      "Private rooftop lounge",
      "Floor-to-ceiling windows",
      "Secured parking + EV charger",
      "Concierge building services",
      "Walk to Arts District",
      "European appliance package",
    ],
    images: [
      img("1545324418-cc1a3fa10c00"),
      img("1502672260266-1c1ef2d93688"),
      img("1556912173-3bb406ef7e77"),
    ],
  },
  {
    slug: "1117-ridgeley-drive",
    address: "1117 Ridgeley Drive",
    city: "Los Angeles",
    state: "CA",
    zip: "90019",
    neighborhood: "Mid-Wilshire",
    price: 725000,
    status: "For Sale",
    type: "Bungalow",
    beds: 3,
    baths: 2,
    sqft: 1750,
    yearBuilt: 1928,
    lotSqft: 5800,
    featured: true,
    agent: "agent-brooklyn",
    summary:
      "A beautifully restored 1920s Spanish bungalow with arched doorways, original tile, and a lush, private backyard.",
    description:
      "Character and craftsmanship meet in this restored Spanish bungalow. Arched doorways, hand-glazed tile, and a barrel-vaulted living room nod to its 1928 heritage, while the kitchen and baths have been thoughtfully modernized. The deep, hedged lot offers a patio, citrus trees, and room for a future ADU.",
    features: [
      "Original 1928 details",
      "Updated kitchen and baths",
      "Private hedged backyard",
      "Citrus trees + patio",
      "ADU potential",
      "Central air",
    ],
    images: [
      img("1570129477492-45c003edd2be"),
      img("1583608205776-bfd35f0d9f83"),
      img("1586023492125-27b2c045efd7"),
    ],
  },
  {
    slug: "10374-mississippi-ave",
    address: "10374 Mississippi Ave",
    city: "Los Angeles",
    state: "CA",
    zip: "90025",
    neighborhood: "West LA",
    price: 450000,
    status: "For Sale",
    type: "Apartment",
    beds: 3,
    baths: 2,
    sqft: 1850,
    yearBuilt: 2005,
    lotSqft: 0,
    featured: false,
    agent: "agent-robert",
    summary:
      "A spacious West LA condo with an open plan, a chef's kitchen, and an oversized balcony — moments from the Expo Line.",
    description:
      "A turnkey condo in the heart of West LA. The open plan connects living, dining, and a chef's kitchen with stone counters and a breakfast bar. Three bedrooms include a generous primary with walk-in closet and en-suite. An oversized balcony extends the living space outdoors, and two-car secured parking completes the package.",
    features: [
      "Oversized private balcony",
      "Open-concept living",
      "In-unit laundry",
      "Two-car secured parking",
      "Steps to the Expo Line",
      "Low HOA",
    ],
    images: [
      img("1493809842364-78817add7ffb"),
      img("1560448204-e02f11c3d0e2"),
      img("1556909114-f6e7ad7d3136"),
    ],
  },
  {
    slug: "2436-lake-view-ave",
    address: "2436 Lake View Ave",
    city: "Los Angeles",
    state: "CA",
    zip: "90039",
    neighborhood: "Silver Lake",
    price: 600000,
    status: "For Sale",
    type: "Bungalow",
    beds: 3,
    baths: 2,
    sqft: 1850,
    yearBuilt: 1949,
    lotSqft: 5100,
    featured: false,
    agent: "agent-leslie",
    summary:
      "A designer Silver Lake hideaway with reservoir glimpses, a sun-soaked studio, and a terraced garden.",
    description:
      "Perched above the reservoir, this Silver Lake hideaway is all light and warmth. A reimagined open kitchen, white-oak floors, and walls of glass blur the line between inside and out. The terraced garden steps down to a fire-pit lounge, and a detached studio is ideal for a creative practice or home office.",
    features: [
      "Reservoir glimpses",
      "Detached studio / office",
      "Terraced garden + fire pit",
      "White-oak flooring",
      "Designer kitchen",
      "Walk to Sunset Junction",
    ],
    images: [
      img("1512917774080-9991f1c4c750"),
      img("1505691938895-1758d7feb511"),
      img("1505693416388-ac5ce068fe85"),
    ],
  },
  {
    slug: "1923-n-hillhurst-ave",
    address: "1923 N Hillhurst Ave",
    city: "Los Angeles",
    state: "CA",
    zip: "90027",
    neighborhood: "Los Feliz",
    price: 1450000,
    status: "For Sale",
    type: "Luxury Rental",
    beds: 4,
    baths: 4,
    sqft: 3200,
    yearBuilt: 1995,
    lotSqft: 8400,
    featured: true,
    agent: "agent-albert",
    summary:
      "A gated Los Feliz estate with a resort-style pool, a chef's kitchen, and a primary wing overlooking the gardens.",
    description:
      "Privacy and polish behind a gated motor court. This Los Feliz estate centers on a double-height living room that opens to a resort-style pool and spa. The chef's kitchen flows to a family room and covered loggia, while the upstairs primary wing features dual baths, a fireplace, and a sitting room overlooking the gardens.",
    features: [
      "Gated motor court",
      "Resort-style pool + spa",
      "Double-height living room",
      "Primary wing with sitting room",
      "Covered loggia",
      "Three-car garage",
    ],
    images: [
      img("1613490493576-7fde63acd811"),
      img("1600607687939-ce8a6c25118c"),
      img("1600210492486-724fe5c67fb0"),
    ],
  },
  {
    slug: "8920-harratt-st",
    address: "8920 Harratt St",
    city: "West Hollywood",
    state: "CA",
    zip: "90069",
    neighborhood: "West Hollywood",
    price: 1500000,
    status: "For Sale",
    type: "City Townhouse",
    beds: 3,
    baths: 4,
    sqft: 2600,
    yearBuilt: 2016,
    lotSqft: 0,
    featured: false,
    agent: "agent-brooklyn",
    summary:
      "An architectural WeHo townhome with a private elevator, a rooftop deck, and skyline-to-ocean views.",
    description:
      "A statement in glass and steel just off the Sunset Strip. A private elevator connects all levels, culminating in a rooftop deck with skyline-to-ocean views, an outdoor kitchen, and a spa. Interiors feature wide-plank floors, a floating staircase, and a primary suite with dual closets and a sculptural soaking tub.",
    features: [
      "Private elevator",
      "Rooftop deck + spa",
      "Outdoor kitchen",
      "Floating staircase",
      "Smart-home system",
      "Two-car garage",
    ],
    images: [
      img("1600047509807-ba8f99d2cdde"),
      img("1600566752355-35792bedcfea"),
      img("1556912167-f556f1f39fdf"),
    ],
  },
  {
    slug: "3650-multiview-dr",
    address: "3650 Multiview Dr",
    city: "Los Angeles",
    state: "CA",
    zip: "90068",
    neighborhood: "Hollywood Hills",
    price: 1500000,
    status: "For Sale",
    type: "Cabin",
    beds: 3,
    baths: 2,
    sqft: 4500,
    yearBuilt: 1978,
    lotSqft: 14000,
    featured: false,
    agent: "agent-robert",
    summary:
      "A serene mountain retreat above the city — walls of glass, soaring ceilings, and total privacy among the trees.",
    description:
      "An escape minutes from the Strip. This tree-shrouded retreat opens to walls of glass and soaring tongue-and-groove ceilings. A great room with a stone fireplace anchors the main level, flowing to view decks on every side. The flexible floor plan suits a studio, gym, or screening room, and the oversized lot offers true seclusion.",
    features: [
      "Total privacy among the trees",
      "Walls of glass + view decks",
      "Soaring wood ceilings",
      "Stone fireplace",
      "Oversized 14,000 sq ft lot",
      "Flexible bonus level",
    ],
    images: [
      img("1518780664697-55e3ad937233"),
      img("1449844908441-8829872d2607"),
      img("1416331108676-a22ccb276e35"),
    ],
  },
];

export const agents: Record<string, DemoAgent> = {
  "agent-leslie": {
    name: "Leslie Alexander",
    title: "Principal Agent · DRE #02014455",
    phone: "(323) 555-0188",
    email: "leslie@dreamneighborhood.com",
    photo:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
  },
  "agent-albert": {
    name: "Albert Flores",
    title: "Senior Agent · DRE #02019921",
    phone: "(323) 555-0190",
    email: "albert@dreamneighborhood.com",
    photo:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  },
  "agent-brooklyn": {
    name: "Brooklyn Simmons",
    title: "Luxury Specialist · DRE #02022210",
    phone: "(323) 555-0193",
    email: "brooklyn@dreamneighborhood.com",
    photo:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80",
  },
  "agent-robert": {
    name: "Robert Fox",
    title: "Associate Agent · DRE #02025518",
    phone: "(323) 555-0197",
    email: "robert@dreamneighborhood.com",
    photo:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
  },
};

export const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export const fullAddress = (p: Pick<DemoProperty, "address" | "city" | "state" | "zip">) =>
  `${p.address}, ${p.city}, ${p.state} ${p.zip}`;

export function getPropertyBySlug(slug: string): DemoProperty | null {
  return properties.find((p) => p.slug === slug) ?? null;
}
