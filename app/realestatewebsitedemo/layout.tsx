import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { DemoChrome } from "@/components/demoRealty/DemoChrome";
import { site } from "@/lib/demoRealty/site";
import "./demo.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-dn-sans-loaded",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-dn-display-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${site.name} — School Explorer demo`,
    template: `%s | ${site.name} demo`,
  },
  description: site.description,
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`dn-demo ${outfit.variable} ${fraunces.variable}`}>
      <DemoChrome>{children}</DemoChrome>
    </div>
  );
}
