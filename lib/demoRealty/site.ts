import { DEMO_BASE, demoPath } from "./base";

export const site = {
  name: "DN Realty",
  tagline: "Find your home with confidence.",
  description:
    "DN Realty connects you with exclusive real estate opportunities and gives every listing school ratings via Dream Neighborhood School Explorer — a free popup and embed for realtor sites.",
  url: `https://www.dreamneighborhoodschools.com${DEMO_BASE}`,
  email: "sales@dreamneighborhood.com",
  phone: "(772) 202-0185",
  address: "St. Lucie Village, FL",
};

export const nav = [
  { label: "Home", href: demoPath("/") },
  { label: "Listings", href: demoPath("/listings") },
  { label: "Neighborhoods", href: demoPath("/neighborhoods"), matchSection: "neighborhoods" as const },
];

export const stats = [
  { value: "95%", label: "Customer satisfaction" },
  { value: "50+", label: "Licensed agents" },
  { value: "20+", label: "Years of experience" },
  { value: "1 line", label: "of code for school ratings" },
];

export const testimonials = [
  {
    quote:
      "DN Realty made the entire home-buying process feel smooth and stress-free. They were responsive, knowledgeable, and always had our best interests in mind.",
    name: "Leslie Alexander",
    location: "Los Angeles, USA",
  },
  {
    quote:
      "Working with DN Realty was a great decision. The school ratings popup on every listing sealed the deal — we never left their site to research schools.",
    name: "Albert Flores",
    location: "Los Angeles, USA",
  },
  {
    quote:
      "From the first showing to closing day, they were proactive, friendly, and extremely organized. It felt like they genuinely cared about finding the right fit.",
    name: "Brooklyn Simmons",
    location: "Los Angeles, CA",
  },
];
