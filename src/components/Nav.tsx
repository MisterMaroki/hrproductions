'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from './Nav.module.css';

const links = [
	{ href: '#work', label: 'Gallery' },
	{ href: '#services', label: 'Services' },
	{ href: '#book', label: 'Book' },
];

export default function Nav() {
	const [scrolled, setScrolled] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 100);
		window.addEventListener('scroll', onScroll);
		return () => window.removeEventListener('scroll', onScroll);
	}, []);

	useEffect(() => {
		if (menuOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	}, [menuOpen]);

	return (
		<>
			<nav
				className={`${styles.nav} ${scrolled ? styles.scrolled : ''} ${menuOpen ? styles.open : ''}`}
			>
				<div className={styles.inner}>
					<a href="#top" className={styles.logo}>
						<Image
							src="/logo.svg"
							alt="The Property Room"
							width={400}
							height={400}
							priority
						/>
					</a>
					<button
						className={styles.burger}
						onClick={() => setMenuOpen(!menuOpen)}
						aria-label="Toggle menu"
					>
						<span className={styles.burgerLine} />
						<span className={styles.burgerLine} />
					</button>
					{/* Desktop links */}
					<div className={styles.links}>
						{links.map((l) => (
							<a key={l.href} href={l.href}>
								{l.label}
							</a>
						))}
					</div>
				</div>
			</nav>

			{/* Fullscreen mobile menu */}
			<div
				className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}
			>
				<div className={styles.menuInner}>
					<div className={styles.menuLinks}>
						{links.map((l, i) => (
							<a
								key={l.href}
								href={l.href}
								className={`${styles.menuLink} ${menuOpen ? styles.menuLinkVisible : ''}`}
								style={{
									transitionDelay: menuOpen ? `${0.15 + i * 0.08}s` : '0s',
								}}
								onClick={() => setMenuOpen(false)}
							>
								<span className={styles.menuNumber}>0{i + 1}</span>
								<span className={styles.menuLabel}>{l.label}</span>
							</a>
						))}
					</div>
					<div
						className={`${styles.menuFooter} ${menuOpen ? styles.menuFooterVisible : ''}`}
						style={{ transitionDelay: menuOpen ? '0.45s' : '0s' }}
					>
						<div className={styles.menuRule} />
						<p className={styles.menuTagline}>
							Property Marketing & Visual Media
						</p>
					</div>
				</div>
			</div>
		</>
	);
}
