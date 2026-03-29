import { redirect } from "next/navigation";
import { isWhiteLabel } from "@/lib/brand";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import TradeAccountBanner from "@/components/TradeAccountBanner";
import Gallery from "@/components/Gallery";
import Services from "@/components/Services";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
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
