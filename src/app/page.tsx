import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isWhiteLabel } from "@/lib/brand";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import TradeAccountBanner from "@/components/TradeAccountBanner";
import Gallery from "@/components/Gallery";
import Services from "@/components/Services";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default async function Home() {
  // Force dynamic — headers() opts out of static rendering
  await headers();

  if (isWhiteLabel()) {
    redirect("/book");
  }

  return (
    <>
      <Nav />
      <main id="top">
        <Hero />
        <TradeAccountBanner />
        <Gallery />
        <Services />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
