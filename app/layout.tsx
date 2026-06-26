import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dream Neighborhood — Schools",
  description:
    "Schools tab demo — district, quality index, and safety data for Fort Pierce / St. Lucie County, FL.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
