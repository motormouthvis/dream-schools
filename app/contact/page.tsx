import { headers } from "next/headers";
import { AppSupportPage } from "@/components/app/AppSupportPage";

export default async function ContactPage() {
  const host = (await headers()).get("host") || "";
  const isApp = host.split(":")[0].toLowerCase().startsWith("app.");
  return <AppSupportPage mode="contact" isApp={isApp} />;
}
