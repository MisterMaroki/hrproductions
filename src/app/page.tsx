import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Gallery from "@/components/Gallery";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="top">
        <Hero />
        <Gallery />
      </main>
    </>
  );
}
