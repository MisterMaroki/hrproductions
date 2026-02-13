# Harrison Ross Website — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single-page scroll website for Harrison Ross's property videography/photography business, with a multi-property booking form and Stripe checkout.

**Architecture:** Next.js App Router, single page (`page.tsx`) composed of section components. Client-side state for the booking basket using React `useState`/`useReducer`. Pure pricing calculation functions tested with Jest. CSS Modules for styling with CSS custom properties for design tokens. Stripe Payment Links for checkout (no backend).

**Tech Stack:** Next.js 14+ (App Router), CSS Modules, Google Fonts (Instrument Serif, DM Sans), Jest for pricing logic tests, Stripe Payment Links, Next.js `<Image>` for optimized images.

**Design doc:** `docs/plans/2026-02-12-harrison-ross-website-design.md`

---

### Task 1: Project Scaffolding

**Files:**
- Create: Next.js project in current directory
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

**Step 1: Initialize Next.js project**

Run:
```bash
npx create-next-app@latest . --typescript --app --src-dir --no-tailwind --no-eslint --import-alias "@/*"
```

Accept defaults. This scaffolds into the current directory.

**Step 2: Clean up boilerplate**

Delete all default content from `src/app/page.tsx` and `src/app/globals.css`. Replace page with a minimal placeholder:

```tsx
// src/app/page.tsx
export default function Home() {
  return <main>Harrison Ross</main>;
}
```

**Step 3: Set up Google Fonts in layout**

Edit `src/app/layout.tsx`:

```tsx
import { Instrument_Serif, DM_Sans } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  title: "Harrison Ross — Property Videography & Photography",
  description:
    "Professional property videography, photography, and drone footage for estate agents. Book online.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${dmSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
```

**Step 4: Set up design tokens in globals.css**

```css
/* src/app/globals.css */
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --color-bg: #fafafa;
  --color-text: #0a0a0a;
  --color-border: #0a0a0a;
  --color-white: #ffffff;

  --font-heading: "Instrument Serif", Georgia, serif;
  --font-body: "DM Sans", system-ui, sans-serif;

  --max-width: 1200px;
  --section-padding: 8rem;
  --content-padding: 1.5rem;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-body);
  background-color: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

img {
  max-width: 100%;
  display: block;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
}
```

**Step 5: Move images to public directory**

Run:
```bash
mv images public/images
```

Next.js serves files from `public/` statically.

**Step 6: Verify dev server runs**

Run:
```bash
npm run dev
```

Expected: Page loads at localhost:3000 showing "Harrison Ross" in DM Sans on off-white background.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with design tokens and fonts"
```

---

### Task 2: Navigation Component

**Files:**
- Create: `src/components/Nav.tsx`
- Create: `src/components/Nav.module.css`
- Modify: `src/app/page.tsx`

**Step 1: Build the Nav component**

```tsx
// src/components/Nav.tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./Nav.module.css";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ""}`}>
      <a href="#top" className={styles.logo}>
        Harrison Ross
      </a>
      <div className={styles.links}>
        <a href="#work">Work</a>
        <a href="#services">Services</a>
        <a href="#book">Book</a>
      </div>
    </nav>
  );
}
```

**Step 2: Style the Nav**

```css
/* src/components/Nav.module.css */
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem var(--content-padding);
  transition: background-color 0.3s ease, border-color 0.3s ease;
  background-color: transparent;
  border-bottom: 1px solid transparent;
}

.scrolled {
  background-color: var(--color-bg);
  border-bottom-color: var(--color-border);
}

.logo {
  font-family: var(--font-heading);
  font-size: 1.25rem;
}

.links {
  display: flex;
  gap: 2rem;
  font-family: var(--font-body);
  font-size: 0.9rem;
}

.links a:hover {
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

@media (max-width: 600px) {
  .links {
    gap: 1.25rem;
    font-size: 0.8rem;
  }

  .logo {
    font-size: 1.1rem;
  }
}
```

**Step 3: Add Nav to the page**

```tsx
// src/app/page.tsx
import Nav from "@/components/Nav";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="top">
        <p>Harrison Ross</p>
      </main>
    </>
  );
}
```

**Step 4: Verify in browser**

Run dev server. Nav should be transparent at top, then gain white background and bottom border on scroll.

**Step 5: Commit**

```bash
git add src/components/Nav.tsx src/components/Nav.module.css src/app/page.tsx
git commit -m "feat: add fixed navigation with scroll state"
```

---

### Task 3: Hero Section

**Files:**
- Create: `src/components/Hero.tsx`
- Create: `src/components/Hero.module.css`
- Modify: `src/app/page.tsx`

**Step 1: Build the Hero component**

Use one of Harrison's best images as the background. `IMG_2905.JPG` (the bright living room with garden doors) works well as a hero.

```tsx
// src/components/Hero.tsx
import Image from "next/image";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <Image
        src="/images/IMG_2905.JPG"
        alt="Property interior by Harrison Ross"
        fill
        priority
        style={{ objectFit: "cover" }}
      />
      <div className={styles.overlay} />
      <div className={styles.content}>
        <h1 className={styles.title}>Harrison Ross</h1>
        <p className={styles.subtitle}>
          Property videography &amp; photography for estate agents
        </p>
        <a href="#book" className={styles.cta}>
          Book a Shoot
        </a>
      </div>
      <div className={styles.arrow}>&#8595;</div>
    </section>
  );
}
```

**Step 2: Style the Hero**

```css
/* src/components/Hero.module.css */
.hero {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  z-index: 1;
}

.content {
  position: relative;
  z-index: 2;
  text-align: center;
  color: var(--color-white);
  padding: 0 var(--content-padding);
}

.title {
  font-family: var(--font-heading);
  font-size: clamp(3rem, 8vw, 6rem);
  font-weight: 400;
  line-height: 1.1;
  margin-bottom: 1rem;
}

.subtitle {
  font-family: var(--font-body);
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  font-weight: 300;
  opacity: 0.9;
  margin-bottom: 2.5rem;
}

.cta {
  display: inline-block;
  font-family: var(--font-body);
  font-size: 0.95rem;
  color: var(--color-white);
  border: 1px solid var(--color-white);
  padding: 0.85rem 2.5rem;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.cta:hover {
  background-color: var(--color-white);
  color: var(--color-text);
}

.arrow {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  color: var(--color-white);
  font-size: 1.5rem;
  opacity: 0;
  animation: fadeIn 1s ease-out 1s forwards;
}

@keyframes fadeIn {
  to {
    opacity: 0.7;
  }
}
```

**Step 3: Add Hero to page**

```tsx
// src/app/page.tsx
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="top">
        <Hero />
      </main>
    </>
  );
}
```

**Step 4: Verify in browser**

Full-viewport hero with dark overlay, white text, "Book a Shoot" button, down arrow fading in after 1s. Nav is transparent over the hero.

**Step 5: Commit**

```bash
git add src/components/Hero.tsx src/components/Hero.module.css src/app/page.tsx
git commit -m "feat: add full-viewport hero section with image background"
```

---

### Task 4: Section Header Component

**Files:**
- Create: `src/components/SectionHeader.tsx`
- Create: `src/components/SectionHeader.module.css`

A reusable component used by Work, Services, and Book sections.

**Step 1: Build the SectionHeader component**

```tsx
// src/components/SectionHeader.tsx
import styles from "./SectionHeader.module.css";

interface SectionHeaderProps {
  title: string;
  id: string;
}

export default function SectionHeader({ title, id }: SectionHeaderProps) {
  return (
    <div className={styles.header} id={id}>
      <h2 className={styles.title}>{title}</h2>
      <hr className={styles.rule} />
    </div>
  );
}
```

**Step 2: Style the SectionHeader**

```css
/* src/components/SectionHeader.module.css */
.header {
  margin-bottom: 4rem;
  scroll-margin-top: 5rem;
}

.title {
  font-family: var(--font-heading);
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 400;
  margin-bottom: 1rem;
}

.rule {
  border: none;
  border-top: 1px solid var(--color-border);
}
```

**Step 3: Commit**

```bash
git add src/components/SectionHeader.tsx src/components/SectionHeader.module.css
git commit -m "feat: add reusable section header component"
```

---

### Task 5: Portfolio Gallery

**Files:**
- Create: `src/components/Gallery.tsx`
- Create: `src/components/Gallery.module.css`
- Create: `src/components/Lightbox.tsx`
- Create: `src/components/Lightbox.module.css`
- Modify: `src/app/page.tsx`

**Step 1: Build the Gallery component**

```tsx
// src/components/Gallery.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import SectionHeader from "./SectionHeader";
import Lightbox from "./Lightbox";
import styles from "./Gallery.module.css";

const images = [
  "IMG_2897.JPG", "IMG_2898.JPG", "IMG_2899.JPG", "IMG_2900.JPG",
  "IMG_2901.JPG", "IMG_2902.JPG", "IMG_2903.JPG", "IMG_2904.JPG",
  "IMG_2905.JPG", "IMG_2906.JPG", "IMG_2907.JPG", "IMG_2908.JPG",
  "IMG_2909.JPG", "IMG_2910.JPG", "IMG_2911.JPG", "IMG_2912.JPG",
  "IMG_2913.JPG", "IMG_2914.JPG", "IMG_2916.JPG",
];

export default function Gallery() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <SectionHeader title="Work" id="work" />
        <div className={styles.grid}>
          {images.map((src, i) => (
            <button
              key={src}
              className={styles.item}
              onClick={() => setLightboxIndex(i)}
            >
              <Image
                src={`/images/${src}`}
                alt={`Property photograph ${i + 1}`}
                width={600}
                height={400}
                style={{ width: "100%", height: "auto" }}
              />
            </button>
          ))}
        </div>
      </div>
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </section>
  );
}
```

**Step 2: Style the Gallery**

```css
/* src/components/Gallery.module.css */
.section {
  padding: var(--section-padding) var(--content-padding);
}

.container {
  max-width: var(--max-width);
  margin: 0 auto;
}

.grid {
  columns: 3;
  column-gap: 4px;
}

.item {
  display: block;
  width: 100%;
  margin-bottom: 4px;
  cursor: pointer;
  border: none;
  padding: 0;
  background: none;
  break-inside: avoid;
}

.item:hover {
  opacity: 0.85;
  transition: opacity 0.2s ease;
}

@media (max-width: 900px) {
  .grid {
    columns: 2;
  }
}

@media (max-width: 500px) {
  .grid {
    columns: 1;
  }
}
```

**Step 3: Build the Lightbox component**

```tsx
// src/components/Lightbox.tsx
"use client";

import { useEffect, useCallback } from "react";
import Image from "next/image";
import styles from "./Lightbox.module.css";

interface LightboxProps {
  images: string[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
}: LightboxProps) {
  const goPrev = useCallback(
    () => onNavigate(index > 0 ? index - 1 : images.length - 1),
    [index, images.length, onNavigate]
  );
  const goNext = useCallback(
    () => onNavigate(index < images.length - 1 ? index + 1 : 0),
    [index, images.length, onNavigate]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, goPrev, goNext]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <button className={styles.close} onClick={onClose}>
        &#x2715;
      </button>
      <button
        className={`${styles.arrow} ${styles.left}`}
        onClick={(e) => {
          e.stopPropagation();
          goPrev();
        }}
      >
        &#8592;
      </button>
      <div className={styles.imageWrap} onClick={(e) => e.stopPropagation()}>
        <Image
          src={`/images/${images[index]}`}
          alt={`Property photograph ${index + 1}`}
          width={1200}
          height={800}
          style={{ width: "100%", height: "auto", maxHeight: "90vh", objectFit: "contain" }}
        />
      </div>
      <button
        className={`${styles.arrow} ${styles.right}`}
        onClick={(e) => {
          e.stopPropagation();
          goNext();
        }}
      >
        &#8594;
      </button>
    </div>
  );
}
```

**Step 4: Style the Lightbox**

```css
/* src/components/Lightbox.module.css */
.backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.95);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

.close {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  color: white;
  font-size: 1.5rem;
  z-index: 201;
}

.arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  color: white;
  font-size: 2rem;
  z-index: 201;
  padding: 1rem;
}

.left {
  left: 1rem;
}

.right {
  right: 1rem;
}

.arrow:hover,
.close:hover {
  opacity: 0.6;
}

.imageWrap {
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**Step 5: Add Gallery to page**

Update `src/app/page.tsx` to include `<Gallery />` after `<Hero />`.

**Step 6: Verify in browser**

Masonry grid of 19 images. Click opens lightbox. Arrow keys and click navigation work. Escape closes.

**Step 7: Commit**

```bash
git add src/components/Gallery.tsx src/components/Gallery.module.css src/components/Lightbox.tsx src/components/Lightbox.module.css src/app/page.tsx
git commit -m "feat: add portfolio gallery with masonry grid and lightbox"
```

---

### Task 6: Services Section

**Files:**
- Create: `src/components/Services.tsx`
- Create: `src/components/Services.module.css`
- Modify: `src/app/page.tsx`

**Step 1: Build the Services component**

```tsx
// src/components/Services.tsx
import SectionHeader from "./SectionHeader";
import styles from "./Services.module.css";

const services = [
  {
    name: "Photography",
    price: "From £130",
    details: ["£6.50 per photo · Min 20 per property", "10% off for 100+ photos"],
  },
  {
    name: "Property Video",
    price: "From £125",
    details: ["2-bed base · +£30 per extra bedroom", "Professional edit included"],
  },
  {
    name: "Drone Footage",
    price: "+£65",
    details: ["Add-on to any video package", "Aerial property & surroundings"],
  },
  {
    name: "Agent Presented Video",
    price: "From £187.50",
    details: [
      "Guided tour with your agent on camera",
      "Directed by Harrison · +£45 per extra bedroom",
    ],
  },
];

export default function Services() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <SectionHeader title="Services" id="services" />
        <div className={styles.grid}>
          {services.map((service) => (
            <div key={service.name} className={styles.card}>
              <h3 className={styles.name}>{service.name}</h3>
              <p className={styles.price}>{service.price}</p>
              {service.details.map((line) => (
                <p key={line} className={styles.detail}>
                  {line}
                </p>
              ))}
              <a href="#book" className={styles.bookLink}>
                Book Now &#8594;
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Style the Services cards**

```css
/* src/components/Services.module.css */
.section {
  padding: var(--section-padding) var(--content-padding);
}

.container {
  max-width: var(--max-width);
  margin: 0 auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
}

.card {
  border: 1px solid var(--color-border);
  padding: 2rem;
  display: flex;
  flex-direction: column;
}

/* Collapse shared borders */
.card + .card {
  border-left: none;
}

.name {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 400;
  margin-bottom: 0.75rem;
}

.price {
  font-family: var(--font-body);
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.detail {
  font-size: 0.9rem;
  opacity: 0.7;
  line-height: 1.5;
  margin-bottom: 0.25rem;
}

.bookLink {
  margin-top: auto;
  padding-top: 1.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  transition: opacity 0.2s ease;
}

.bookLink:hover {
  opacity: 0.6;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }

  /* Reset and redo collapsed borders for 2-col */
  .card + .card {
    border-left: 1px solid var(--color-border);
  }

  .card:nth-child(even) {
    border-left: none;
  }

  .card:nth-child(n + 3) {
    border-top: none;
  }
}

@media (max-width: 500px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .card + .card {
    border-left: 1px solid var(--color-border);
    border-top: none;
  }
}
```

**Step 3: Add Services to page**

Update `src/app/page.tsx` to include `<Services />` after `<Gallery />`.

**Step 4: Verify in browser**

4 cards in a row on desktop with collapsed borders. Responsive at tablet/mobile. "Book Now" links scroll to #book.

**Step 5: Commit**

```bash
git add src/components/Services.tsx src/components/Services.module.css src/app/page.tsx
git commit -m "feat: add services section with pricing cards"
```

---

### Task 7: Pricing Logic (TDD)

**Files:**
- Create: `src/lib/pricing.ts`
- Create: `src/lib/__tests__/pricing.test.ts`

This is the core business logic — pure functions, fully tested.

**Step 1: Install Jest**

Run:
```bash
npm install -D jest @types/jest ts-jest
npx ts-jest config:init
```

**Step 2: Write the failing tests**

```ts
// src/lib/__tests__/pricing.test.ts
import {
  calcPhotography,
  calcStandardVideo,
  calcAgentPresentedVideo,
  calcDrone,
  calcPropertyTotal,
} from "../pricing";

describe("calcPhotography", () => {
  it("calculates price for 20 photos", () => {
    expect(calcPhotography(20)).toBe(130);
  });

  it("calculates price for 50 photos", () => {
    expect(calcPhotography(50)).toBe(325);
  });

  it("applies 10% discount at 100 photos", () => {
    expect(calcPhotography(100)).toBe(585);
  });

  it("applies 10% discount above 100 photos", () => {
    expect(calcPhotography(120)).toBe(702);
  });

  it("enforces minimum of 20 photos", () => {
    expect(calcPhotography(10)).toBe(130);
  });
});

describe("calcStandardVideo", () => {
  it("calculates 2-bed price", () => {
    expect(calcStandardVideo(2)).toBe(125);
  });

  it("calculates 3-bed price", () => {
    expect(calcStandardVideo(3)).toBe(155);
  });

  it("calculates 5-bed price", () => {
    expect(calcStandardVideo(5)).toBe(215);
  });
});

describe("calcAgentPresentedVideo", () => {
  it("calculates 2-bed price (1.5x standard)", () => {
    expect(calcAgentPresentedVideo(2)).toBe(187.5);
  });

  it("calculates 3-bed price", () => {
    expect(calcAgentPresentedVideo(3)).toBe(232.5);
  });

  it("calculates 5-bed price", () => {
    expect(calcAgentPresentedVideo(5)).toBe(322.5);
  });
});

describe("calcDrone", () => {
  it("returns 65", () => {
    expect(calcDrone()).toBe(65);
  });
});

describe("calcPropertyTotal", () => {
  it("calculates photography only", () => {
    const total = calcPropertyTotal({
      bedrooms: 3,
      photography: true,
      photoCount: 20,
      standardVideo: false,
      agentPresentedVideo: false,
      drone: false,
    });
    expect(total).toBe(130);
  });

  it("calculates video + drone", () => {
    const total = calcPropertyTotal({
      bedrooms: 3,
      photography: false,
      photoCount: 0,
      standardVideo: true,
      agentPresentedVideo: false,
      drone: true,
    });
    expect(total).toBe(220); // 155 + 65
  });

  it("calculates agent presented video + drone + photography", () => {
    const total = calcPropertyTotal({
      bedrooms: 4,
      photography: true,
      photoCount: 30,
      standardVideo: false,
      agentPresentedVideo: true,
      drone: true,
    });
    expect(total).toBe(472.5); // 195 + 277.5 + 65 = 537.5... wait
    // 4 bed agent presented = (125 + 2*30) * 1.5 = 185 * 1.5 = 277.5
    // drone = 65
    // photography = 30 * 6.5 = 195
    // total = 277.5 + 65 + 195 = 537.5
  });

  it("ignores drone when no video selected", () => {
    const total = calcPropertyTotal({
      bedrooms: 2,
      photography: true,
      photoCount: 20,
      standardVideo: false,
      agentPresentedVideo: false,
      drone: true,
    });
    expect(total).toBe(130); // drone ignored
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx jest`
Expected: FAIL — module not found

**Step 4: Implement pricing functions**

```ts
// src/lib/pricing.ts
const PHOTO_PRICE = 6.5;
const PHOTO_MIN = 20;
const PHOTO_BULK_THRESHOLD = 100;
const PHOTO_BULK_DISCOUNT = 0.1;

const VIDEO_BASE = 125;
const VIDEO_PER_BEDROOM = 30;
const VIDEO_BASE_BEDROOMS = 2;

const AGENT_PRESENTED_MULTIPLIER = 1.5;
const DRONE_PRICE = 65;

export function calcPhotography(count: number): number {
  const actual = Math.max(count, PHOTO_MIN);
  const subtotal = actual * PHOTO_PRICE;
  if (actual >= PHOTO_BULK_THRESHOLD) {
    return Math.round(subtotal * (1 - PHOTO_BULK_DISCOUNT) * 100) / 100;
  }
  return subtotal;
}

export function calcStandardVideo(bedrooms: number): number {
  return VIDEO_BASE + Math.max(0, bedrooms - VIDEO_BASE_BEDROOMS) * VIDEO_PER_BEDROOM;
}

export function calcAgentPresentedVideo(bedrooms: number): number {
  return calcStandardVideo(bedrooms) * AGENT_PRESENTED_MULTIPLIER;
}

export function calcDrone(): number {
  return DRONE_PRICE;
}

export interface PropertyServices {
  bedrooms: number;
  photography: boolean;
  photoCount: number;
  standardVideo: boolean;
  agentPresentedVideo: boolean;
  drone: boolean;
}

export function calcPropertyTotal(services: PropertyServices): number {
  let total = 0;

  if (services.photography) {
    total += calcPhotography(services.photoCount);
  }

  const hasVideo = services.standardVideo || services.agentPresentedVideo;

  if (services.agentPresentedVideo) {
    total += calcAgentPresentedVideo(services.bedrooms);
  } else if (services.standardVideo) {
    total += calcStandardVideo(services.bedrooms);
  }

  if (services.drone && hasVideo) {
    total += calcDrone();
  }

  return total;
}
```

**Step 5: Fix the test expectation for the combined case**

The test for "agent presented video + drone + photography" has a wrong expected value in the comment. The correct total is 537.5. Update the test:

```ts
  it("calculates agent presented video + drone + photography", () => {
    const total = calcPropertyTotal({
      bedrooms: 4,
      photography: true,
      photoCount: 30,
      standardVideo: false,
      agentPresentedVideo: true,
      drone: true,
    });
    expect(total).toBe(537.5);
  });
```

**Step 6: Run tests to verify they pass**

Run: `npx jest`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/lib/pricing.ts src/lib/__tests__/pricing.test.ts jest.config.ts package.json package-lock.json
git commit -m "feat: add pricing calculation logic with full test coverage"
```

---

### Task 8: Booking Form — State & Agent Details

**Files:**
- Create: `src/components/BookingSection.tsx`
- Create: `src/components/BookingSection.module.css`
- Create: `src/components/AgentDetails.tsx`
- Create: `src/components/AgentDetails.module.css`
- Modify: `src/app/page.tsx`

**Step 1: Define the booking state types**

Add to `src/lib/pricing.ts` (or create `src/lib/types.ts` — keeping it simple, add to pricing):

At the top of `BookingSection.tsx`:

```tsx
// src/components/BookingSection.tsx
"use client";

import { useState } from "react";
import SectionHeader from "./SectionHeader";
import AgentDetails from "./AgentDetails";
import styles from "./BookingSection.module.css";

export interface AgentInfo {
  name: string;
  company: string;
  email: string;
  phone: string;
}

export interface PropertyBooking {
  id: string;
  address: string;
  bedrooms: number;
  preferredDate: string;
  photography: boolean;
  photoCount: number;
  standardVideo: boolean;
  agentPresentedVideo: boolean;
  drone: boolean;
}

function createProperty(): PropertyBooking {
  return {
    id: crypto.randomUUID(),
    address: "",
    bedrooms: 2,
    preferredDate: "",
    photography: false,
    photoCount: 20,
    standardVideo: false,
    agentPresentedVideo: false,
    drone: false,
  };
}

export default function BookingSection() {
  const [agent, setAgent] = useState<AgentInfo>({
    name: "",
    company: "",
    email: "",
    phone: "",
  });
  const [properties, setProperties] = useState<PropertyBooking[]>([
    createProperty(),
  ]);

  const addProperty = () =>
    setProperties((prev) => [...prev, createProperty()]);

  const updateProperty = (id: string, updates: Partial<PropertyBooking>) =>
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );

  const removeProperty = (id: string) =>
    setProperties((prev) => prev.filter((p) => p.id !== id));

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <SectionHeader title="Book" id="book" />
        <div className={styles.layout}>
          <div className={styles.form}>
            <AgentDetails agent={agent} onChange={setAgent} />
            {/* Property blocks will go here in Task 9 */}
            <button className={styles.addProperty} onClick={addProperty}>
              + Add Another Property
            </button>
          </div>
          <div className={styles.basket}>
            {/* Basket component will go here in Task 10 */}
          </div>
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Build the AgentDetails component**

```tsx
// src/components/AgentDetails.tsx
import type { AgentInfo } from "./BookingSection";
import styles from "./AgentDetails.module.css";

interface Props {
  agent: AgentInfo;
  onChange: (agent: AgentInfo) => void;
}

export default function AgentDetails({ agent, onChange }: Props) {
  const update = (field: keyof AgentInfo, value: string) =>
    onChange({ ...agent, [field]: value });

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Your Details</legend>
      <div className={styles.grid}>
        <label className={styles.label}>
          <span>Name</span>
          <input
            type="text"
            value={agent.name}
            onChange={(e) => update("name", e.target.value)}
            className={styles.input}
            required
          />
        </label>
        <label className={styles.label}>
          <span>Company</span>
          <input
            type="text"
            value={agent.company}
            onChange={(e) => update("company", e.target.value)}
            className={styles.input}
            required
          />
        </label>
        <label className={styles.label}>
          <span>Email</span>
          <input
            type="email"
            value={agent.email}
            onChange={(e) => update("email", e.target.value)}
            className={styles.input}
            required
          />
        </label>
        <label className={styles.label}>
          <span>Phone</span>
          <input
            type="tel"
            value={agent.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={styles.input}
            required
          />
        </label>
      </div>
    </fieldset>
  );
}
```

**Step 3: Style AgentDetails and BookingSection**

```css
/* src/components/AgentDetails.module.css */
.fieldset {
  border: none;
  margin-bottom: 3rem;
}

.legend {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 400;
  margin-bottom: 1.5rem;
  display: block;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 500;
}

.input {
  font-family: var(--font-body);
  font-size: 0.95rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-white);
  outline: none;
  transition: border-color 0.2s ease;
}

.input:focus {
  border-color: var(--color-text);
  outline: 2px solid var(--color-text);
  outline-offset: -2px;
}

@media (max-width: 500px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
```

```css
/* src/components/BookingSection.module.css */
.section {
  padding: var(--section-padding) var(--content-padding);
}

.container {
  max-width: var(--max-width);
  margin: 0 auto;
}

.layout {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 3rem;
  align-items: start;
}

.form {
  min-width: 0;
}

.basket {
  position: sticky;
  top: 5rem;
}

.addProperty {
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 500;
  padding: 0.85rem 2rem;
  border: 1px solid var(--color-border);
  width: 100%;
  text-align: center;
  transition: background-color 0.2s ease;
}

.addProperty:hover {
  background-color: var(--color-text);
  color: var(--color-white);
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .basket {
    position: static;
  }
}
```

**Step 4: Add BookingSection to page**

Update `src/app/page.tsx` to include `<BookingSection />` after `<Services />`.

**Step 5: Verify in browser**

Agent details form renders with 4 fields in a 2x2 grid. "Add Another Property" button visible. Sticky basket column on right (empty for now).

**Step 6: Commit**

```bash
git add src/components/BookingSection.tsx src/components/BookingSection.module.css src/components/AgentDetails.tsx src/components/AgentDetails.module.css src/app/page.tsx
git commit -m "feat: add booking section with agent details form and state management"
```

---

### Task 9: Property Block Component

**Files:**
- Create: `src/components/PropertyBlock.tsx`
- Create: `src/components/PropertyBlock.module.css`
- Modify: `src/components/BookingSection.tsx`

**Step 1: Build the PropertyBlock component**

```tsx
// src/components/PropertyBlock.tsx
import type { PropertyBooking } from "./BookingSection";
import { calcPropertyTotal } from "@/lib/pricing";
import styles from "./PropertyBlock.module.css";

interface Props {
  property: PropertyBooking;
  onChange: (updates: Partial<PropertyBooking>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export default function PropertyBlock({
  property,
  onChange,
  onRemove,
  canRemove,
}: Props) {
  const toggleService = (
    service: "photography" | "standardVideo" | "agentPresentedVideo" | "drone"
  ) => {
    if (service === "standardVideo") {
      onChange({
        standardVideo: !property.standardVideo,
        agentPresentedVideo: false,
        drone: !property.standardVideo ? property.drone : false,
      });
    } else if (service === "agentPresentedVideo") {
      onChange({
        agentPresentedVideo: !property.agentPresentedVideo,
        standardVideo: false,
        drone: !property.agentPresentedVideo ? property.drone : false,
      });
    } else if (service === "drone") {
      if (property.standardVideo || property.agentPresentedVideo) {
        onChange({ drone: !property.drone });
      }
    } else if (service === "photography") {
      onChange({ photography: !property.photography });
    }
  };

  const hasVideo = property.standardVideo || property.agentPresentedVideo;
  const subtotal = calcPropertyTotal(property);

  return (
    <div className={styles.block}>
      <div className={styles.header}>
        <span className={styles.label}>Property</span>
        {canRemove && (
          <button className={styles.remove} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Address</span>
          <input
            type="text"
            value={property.address}
            onChange={(e) => onChange({ address: e.target.value })}
            className={styles.input}
            placeholder="Full property address"
            required
          />
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span>Bedrooms</span>
            <select
              value={property.bedrooms}
              onChange={(e) =>
                onChange({ bedrooms: parseInt(e.target.value, 10) })
              }
              className={styles.input}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n === 6 ? "6+" : n}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Preferred Date</span>
            <input
              type="date"
              value={property.preferredDate}
              onChange={(e) => onChange({ preferredDate: e.target.value })}
              className={styles.input}
              required
            />
          </label>
        </div>
      </div>

      <div className={styles.services}>
        <span className={styles.servicesLabel}>Services</span>
        <div className={styles.pills}>
          <button
            className={`${styles.pill} ${property.photography ? styles.active : ""}`}
            onClick={() => toggleService("photography")}
            type="button"
          >
            Photography
          </button>
          <button
            className={`${styles.pill} ${property.standardVideo ? styles.active : ""}`}
            onClick={() => toggleService("standardVideo")}
            type="button"
          >
            Property Video
          </button>
          <button
            className={`${styles.pill} ${property.drone ? styles.active : ""} ${!hasVideo ? styles.disabled : ""}`}
            onClick={() => toggleService("drone")}
            type="button"
            disabled={!hasVideo}
          >
            Drone Footage
          </button>
          <button
            className={`${styles.pill} ${property.agentPresentedVideo ? styles.active : ""}`}
            onClick={() => toggleService("agentPresentedVideo")}
            type="button"
          >
            Agent Presented
          </button>
        </div>
      </div>

      {property.photography && (
        <label className={styles.photoCount}>
          <span>Number of photos</span>
          <input
            type="number"
            min={20}
            value={property.photoCount}
            onChange={(e) =>
              onChange({ photoCount: Math.max(20, parseInt(e.target.value, 10) || 20) })
            }
            className={styles.input}
          />
        </label>
      )}

      {subtotal > 0 && (
        <div className={styles.subtotal}>
          Subtotal: <strong>£{subtotal.toFixed(2)}</strong>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Style the PropertyBlock**

```css
/* src/components/PropertyBlock.module.css */
.block {
  border: 1px solid var(--color-border);
  padding: 2rem;
  margin-bottom: 1.5rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.label {
  font-family: var(--font-heading);
  font-size: 1.25rem;
}

.remove {
  font-size: 0.85rem;
  color: var(--color-text);
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.remove:hover {
  opacity: 1;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 500;
}

.input {
  font-family: var(--font-body);
  font-size: 0.95rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-white);
  outline: none;
}

.input:focus {
  outline: 2px solid var(--color-text);
  outline-offset: -2px;
}

.services {
  margin-bottom: 1.5rem;
}

.servicesLabel {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pill {
  font-family: var(--font-body);
  font-size: 0.85rem;
  padding: 0.6rem 1.25rem;
  border: 1px solid var(--color-border);
  background: transparent;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.pill:hover:not(.disabled) {
  background-color: var(--color-text);
  color: var(--color-white);
}

.active {
  background-color: var(--color-text);
  color: var(--color-white);
}

.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.photoCount {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 1.5rem;
  max-width: 200px;
}

.subtotal {
  font-size: 0.95rem;
  text-align: right;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

@media (max-width: 500px) {
  .row {
    grid-template-columns: 1fr;
  }

  .pills {
    flex-direction: column;
  }

  .pill {
    text-align: center;
  }
}
```

**Step 3: Wire PropertyBlock into BookingSection**

Update `BookingSection.tsx` — import `PropertyBlock` and render property blocks:

Replace the `{/* Property blocks will go here in Task 9 */}` comment with:

```tsx
{properties.map((property) => (
  <PropertyBlock
    key={property.id}
    property={property}
    onChange={(updates) => updateProperty(property.id, updates)}
    onRemove={() => removeProperty(property.id)}
    canRemove={properties.length > 1}
  />
))}
```

Add the import: `import PropertyBlock from "./PropertyBlock";`

**Step 4: Verify in browser**

Property block with address, bedrooms, date, service pills. Toggle pills — drone disabled unless video selected. Photography reveals photo count. Subtotal updates live. "Add Another Property" adds a new block. Remove button appears when 2+ properties.

**Step 5: Commit**

```bash
git add src/components/PropertyBlock.tsx src/components/PropertyBlock.module.css src/components/BookingSection.tsx
git commit -m "feat: add property block with service toggles and live subtotal"
```

---

### Task 10: Basket Component

**Files:**
- Create: `src/components/Basket.tsx`
- Create: `src/components/Basket.module.css`
- Modify: `src/components/BookingSection.tsx`

**Step 1: Build the Basket component**

```tsx
// src/components/Basket.tsx
"use client";

import { useState } from "react";
import type { PropertyBooking, AgentInfo } from "./BookingSection";
import {
  calcPhotography,
  calcStandardVideo,
  calcAgentPresentedVideo,
  calcDrone,
  calcPropertyTotal,
} from "@/lib/pricing";
import styles from "./Basket.module.css";

interface Props {
  properties: PropertyBooking[];
  agent: AgentInfo;
}

function getLineItems(property: PropertyBooking) {
  const items: { label: string; price: number }[] = [];

  if (property.photography) {
    const price = calcPhotography(property.photoCount);
    const bulkApplied = property.photoCount >= 100;
    items.push({
      label: `Photography (${property.photoCount} photos)${bulkApplied ? " — 10% off" : ""}`,
      price,
    });
  }

  if (property.agentPresentedVideo) {
    items.push({
      label: `Agent Presented Video (${property.bedrooms}-bed)`,
      price: calcAgentPresentedVideo(property.bedrooms),
    });
  } else if (property.standardVideo) {
    items.push({
      label: `Property Video (${property.bedrooms}-bed)`,
      price: calcStandardVideo(property.bedrooms),
    });
  }

  const hasVideo = property.standardVideo || property.agentPresentedVideo;
  if (property.drone && hasVideo) {
    items.push({ label: "Drone Footage", price: calcDrone() });
  }

  return items;
}

export default function Basket({ properties, agent }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const propertyTotals = properties.map((p) => ({
    property: p,
    items: getLineItems(p),
    subtotal: calcPropertyTotal(p),
  }));

  const grandTotal = propertyTotals.reduce((sum, p) => sum + p.subtotal, 0);
  const hasItems = grandTotal > 0;

  const handleCheckout = () => {
    // TODO: Build Stripe Payment Link URL with basket data
    // For now, log the order
    console.log("Order:", { agent, properties: propertyTotals });
    alert("Stripe checkout will be connected here. Order logged to console.");
  };

  const basketContent = (
    <>
      {propertyTotals.map(({ property, items, subtotal }) => {
        if (items.length === 0) return null;
        return (
          <div key={property.id} className={styles.property}>
            <p className={styles.address}>
              {property.address || "No address yet"}
            </p>
            {items.map((item) => (
              <div key={item.label} className={styles.lineItem}>
                <span>{item.label}</span>
                <span>£{item.price.toFixed(2)}</span>
              </div>
            ))}
            <div className={styles.propertySubtotal}>
              <span>Subtotal</span>
              <span>£{subtotal.toFixed(2)}</span>
            </div>
          </div>
        );
      })}

      <div className={styles.total}>
        <span>Total</span>
        <span>£{grandTotal.toFixed(2)}</span>
      </div>

      <button
        className={styles.checkout}
        onClick={handleCheckout}
        disabled={!hasItems}
      >
        Proceed to Payment
      </button>
    </>
  );

  return (
    <>
      {/* Desktop basket */}
      <div className={styles.desktop}>
        <h3 className={styles.heading}>Your Booking</h3>
        {hasItems ? (
          basketContent
        ) : (
          <p className={styles.empty}>Select services to get started</p>
        )}
      </div>

      {/* Mobile bottom bar */}
      <div className={styles.mobileBar}>
        <div className={styles.mobileBarInner}>
          <button
            className={styles.mobileToggle}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? "Hide Basket" : "View Basket"} — £
            {grandTotal.toFixed(2)}
          </button>
          <button
            className={styles.mobileCheckout}
            onClick={handleCheckout}
            disabled={!hasItems}
          >
            Pay
          </button>
        </div>
        {mobileOpen && (
          <div className={styles.mobilePanel}>{basketContent}</div>
        )}
      </div>
    </>
  );
}
```

**Step 2: Style the Basket**

```css
/* src/components/Basket.module.css */
.desktop {
  border: 1px solid var(--color-border);
  padding: 2rem;
}

.heading {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 400;
  margin-bottom: 1.5rem;
}

.empty {
  font-size: 0.9rem;
  opacity: 0.5;
}

.property {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.address {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.lineItem {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  padding: 0.25rem 0;
  opacity: 0.8;
}

.propertySubtotal {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  font-weight: 600;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
}

.total {
  display: flex;
  justify-content: space-between;
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  padding-top: 0.5rem;
}

.checkout {
  width: 100%;
  padding: 1rem;
  background-color: var(--color-text);
  color: var(--color-white);
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 600;
  border: 1px solid var(--color-text);
  transition: opacity 0.2s ease;
}

.checkout:hover:not(:disabled) {
  opacity: 0.85;
}

.checkout:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Mobile bottom bar — hidden on desktop */
.mobileBar {
  display: none;
}

@media (max-width: 900px) {
  .desktop {
    display: none;
  }

  .mobileBar {
    display: block;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 150;
    background-color: var(--color-bg);
    border-top: 1px solid var(--color-border);
  }

  .mobileBarInner {
    display: flex;
    gap: 0.5rem;
    padding: 1rem var(--content-padding);
  }

  .mobileToggle {
    flex: 1;
    font-family: var(--font-body);
    font-size: 0.9rem;
    font-weight: 600;
    text-align: left;
  }

  .mobileCheckout {
    padding: 0.75rem 1.5rem;
    background-color: var(--color-text);
    color: var(--color-white);
    font-family: var(--font-body);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .mobileCheckout:disabled {
    opacity: 0.3;
  }

  .mobilePanel {
    padding: 1.5rem var(--content-padding);
    border-top: 1px solid var(--color-border);
    max-height: 60vh;
    overflow-y: auto;
  }
}
```

**Step 3: Wire Basket into BookingSection**

Update `BookingSection.tsx` — import `Basket` and replace the basket placeholder:

```tsx
import Basket from "./Basket";
```

Replace `{/* Basket component will go here in Task 10 */}` with:

```tsx
<Basket properties={properties} agent={agent} />
```

**Step 4: Verify in browser**

Desktop: sticky basket on right updates as services are toggled. Shows line items per property, subtotals, grand total. "Proceed to Payment" button (shows alert for now). Mobile: fixed bottom bar with total and toggle.

**Step 5: Commit**

```bash
git add src/components/Basket.tsx src/components/Basket.module.css src/components/BookingSection.tsx
git commit -m "feat: add live basket with line items, totals, and mobile bottom bar"
```

---

### Task 11: Footer

**Files:**
- Create: `src/components/Footer.tsx`
- Create: `src/components/Footer.module.css`
- Modify: `src/app/page.tsx`

**Step 1: Build the Footer component**

```tsx
// src/components/Footer.tsx
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.brand}>Harrison Ross</span>
        <span className={styles.contact}>
          <a href="mailto:hello@harrisonross.co.uk">hello@harrisonross.co.uk</a>
        </span>
      </div>
    </footer>
  );
}
```

Note: Email is a placeholder. Harrison can update it later.

**Step 2: Style the Footer**

```css
/* src/components/Footer.module.css */
.footer {
  border-top: 1px solid var(--color-border);
  padding: 2rem var(--content-padding);
}

.inner {
  max-width: var(--max-width);
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand {
  font-family: var(--font-heading);
  font-size: 1rem;
}

.contact a {
  font-size: 0.9rem;
  transition: opacity 0.2s ease;
}

.contact a:hover {
  opacity: 0.6;
}

@media (max-width: 500px) {
  .inner {
    flex-direction: column;
    gap: 0.75rem;
    text-align: center;
  }
}
```

**Step 3: Add Footer to page and add mobile basket padding**

Update `src/app/page.tsx` to include `<Footer />` after `<BookingSection />`.

Also add bottom padding to `<main>` for the mobile basket bar:

```tsx
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Gallery from "@/components/Gallery";
import Services from "@/components/Services";
import BookingSection from "@/components/BookingSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="top">
        <Hero />
        <Gallery />
        <Services />
        <BookingSection />
      </main>
      <Footer />
    </>
  );
}
```

Add to `globals.css`:
```css
@media (max-width: 900px) {
  body {
    padding-bottom: 5rem;
  }
}
```

**Step 4: Verify in browser**

Minimal footer with brand name and email. Responsive. Mobile has enough bottom padding to clear the fixed basket bar.

**Step 5: Commit**

```bash
git add src/components/Footer.tsx src/components/Footer.module.css src/app/page.tsx src/app/globals.css
git commit -m "feat: add minimal footer and mobile layout padding"
```

---

### Task 12: Scroll Fade-In Animations

**Files:**
- Create: `src/hooks/useFadeIn.ts`
- Modify: `src/app/globals.css`
- Modify: `src/components/Gallery.tsx`
- Modify: `src/components/Services.tsx`
- Modify: `src/components/BookingSection.tsx`

**Step 1: Create the useFadeIn hook**

Uses IntersectionObserver to add a CSS class when elements enter the viewport.

```ts
// src/hooks/useFadeIn.ts
"use client";

import { useEffect, useRef } from "react";

export function useFadeIn<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
```

**Step 2: Add fade-in CSS to globals.css**

```css
/* Add to globals.css */
.fade-in {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.5s ease-out, transform 0.5s ease-out;
}

.fade-in.visible {
  opacity: 1;
  transform: translateY(0);
}
```

**Step 3: Apply to Gallery, Services, BookingSection**

In each component's section wrapper, add the `fade-in` class and the ref:

For `Gallery.tsx`:
```tsx
import { useFadeIn } from "@/hooks/useFadeIn";
// ...
const ref = useFadeIn<HTMLElement>();
return <section ref={ref} className={`${styles.section} fade-in`}> ...
```

Apply the same pattern to `Services.tsx` and `BookingSection.tsx`. Services needs to become a client component (`"use client"`) to use the hook.

**Step 4: Verify in browser**

Sections fade in and slide up as you scroll down the page. Each section animates once and stays visible.

**Step 5: Commit**

```bash
git add src/hooks/useFadeIn.ts src/app/globals.css src/components/Gallery.tsx src/components/Services.tsx src/components/BookingSection.tsx
git commit -m "feat: add scroll-triggered fade-in animations"
```

---

### Task 13: Stripe Payment Link Integration

**Files:**
- Modify: `src/components/Basket.tsx`

This task connects the "Proceed to Payment" button to Stripe. Since we're using Stripe Payment Links, the approach is:

1. Harrison creates products in Stripe Dashboard for each service
2. We build a Stripe Payment Link URL with line items from the basket
3. Agent/property details are passed as metadata in the URL

**Step 1: Create a config for Stripe product price IDs**

```ts
// src/lib/stripe.ts
// Harrison will replace these with real Stripe Price IDs from his dashboard.
// Each service needs a Stripe Product with a unit price created in Stripe Dashboard.
// For variable pricing (per-bedroom), create separate prices or use quantity.

export const STRIPE_CONFIG = {
  // Replace with actual Stripe Payment Link base URL
  paymentLinkBase: "https://buy.stripe.com/PLACEHOLDER",

  // These are placeholder Stripe Price IDs.
  // Harrison creates these in Stripe Dashboard > Products.
  priceIds: {
    photoSingle: "price_PLACEHOLDER_photo",        // £6.50 per photo
    videoBase: "price_PLACEHOLDER_video_base",      // £125 base
    videoPerBedroom: "price_PLACEHOLDER_video_bed", // £30 per extra bedroom
    drone: "price_PLACEHOLDER_drone",               // £65
    agentVideoBase: "price_PLACEHOLDER_agent_base", // £187.50 base
    agentVideoPerBedroom: "price_PLACEHOLDER_agent_bed", // £45 per extra bedroom
  },
};
```

**Step 2: Update Basket checkout handler**

For the MVP, since Stripe Payment Links have limited dynamic line-item support, the simplest approach is to use **Stripe Checkout with a client-only redirect**. However, since Payment Links don't support dynamic quantities natively via URL parameters in a multi-product way, the pragmatic approach is:

Option A: Use a single Stripe Payment Link with a fixed amount (requires Harrison to manually reconcile)
Option B: Add a tiny API route to create a Stripe Checkout Session

For now, we'll build a clear order summary that gets sent via email (using a mailto: fallback) with the Payment Link. Harrison can set up the full Stripe Checkout Session API route later when he has his Stripe account ready.

Update the `handleCheckout` in `Basket.tsx`:

```tsx
const handleCheckout = () => {
  const orderLines = propertyTotals
    .filter(({ items }) => items.length > 0)
    .map(({ property, items, subtotal }) =>
      `${property.address || "TBC"} (${property.bedrooms}-bed, ${property.preferredDate || "date TBC"}):\n${items.map((i) => `  - ${i.label}: £${i.price.toFixed(2)}`).join("\n")}\n  Subtotal: £${subtotal.toFixed(2)}`
    )
    .join("\n\n");

  const body = `New Booking Request\n\nAgent: ${agent.name}\nCompany: ${agent.company}\nEmail: ${agent.email}\nPhone: ${agent.phone}\n\n${orderLines}\n\nTotal: £${grandTotal.toFixed(2)}`;

  // Open mailto as fallback until Stripe is configured
  const mailto = `mailto:hello@harrisonross.co.uk?subject=${encodeURIComponent(`Booking Request — £${grandTotal.toFixed(2)}`)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
};
```

A comment in the code should note: "Replace with Stripe Checkout Session redirect when Stripe account is set up. See docs/plans/ for Stripe integration notes."

**Step 3: Verify in browser**

Click "Proceed to Payment" opens email client with full order summary pre-filled. All line items, prices, and agent details are included.

**Step 4: Commit**

```bash
git add src/lib/stripe.ts src/components/Basket.tsx
git commit -m "feat: add checkout with order summary (Stripe placeholder + mailto fallback)"
```

---

### Task 14: Final Polish & Verification

**Files:**
- Various — review and fix any issues

**Step 1: Run the dev server and test full flow**

Run: `npm run dev`

Walk through the complete user journey:
1. Hero loads with image, text, CTA
2. Scroll — nav transitions to solid background
3. Gallery loads with masonry grid, lightbox works
4. Services cards display correctly
5. Booking form: fill agent details, add property, toggle services
6. Basket updates live with correct prices
7. Add a second property, verify basket shows both
8. Click "Proceed to Payment" — email opens with full order
9. Test on mobile viewport (responsive layout, bottom basket bar)

**Step 2: Run the pricing tests**

Run: `npx jest`
Expected: All tests PASS

**Step 3: Build for production**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final polish and production build verification"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|-----------------|
| 1 | Project scaffolding (Next.js, fonts, CSS tokens) | 7 |
| 2 | Navigation component | 5 |
| 3 | Hero section | 5 |
| 4 | Section header component | 3 |
| 5 | Portfolio gallery + lightbox | 7 |
| 6 | Services cards | 5 |
| 7 | Pricing logic (TDD) | 7 |
| 8 | Booking form state + agent details | 6 |
| 9 | Property block with service toggles | 5 |
| 10 | Basket component (desktop + mobile) | 5 |
| 11 | Footer | 5 |
| 12 | Scroll animations | 5 |
| 13 | Stripe integration (placeholder + mailto) | 4 |
| 14 | Final polish & verification | 4 |
| **Total** | | **73 steps** |
