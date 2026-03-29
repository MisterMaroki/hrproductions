import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import TradeAccountBanner from "@/components/TradeAccountBanner";
import Gallery from "@/components/Gallery";
import Services from "@/components/Services";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
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
