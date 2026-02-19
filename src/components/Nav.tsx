'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './Nav.module.css';

const landingLinks = [
	{ href: '#work', label: 'Gallery' },
	{ href: '#services', label: 'Services' },
	{ href: '/book', label: 'Book' },
];

const bookPageLinks = [
	{ href: '/#work', label: 'Gallery' },
	{ href: '/#services', label: 'Services' },
];

export default function Nav({ bookPage = false }: { bookPage?: boolean }) {
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

	const links = bookPage ? bookPageLinks : landingLinks;

	const NavLink = ({ href, children, className, style, onClick }: {
		href: string;
		children: React.ReactNode;
		className?: string;
		style?: React.CSSProperties;
		onClick?: () => void;
	}) => {
		const isRoute = href.startsWith('/');
		if (isRoute) {
			return (
				<Link href={href} className={className} style={style} onClick={onClick}>
					{children}
				</Link>
			);
		}
		// Hash links: scroll without pushing to history so back button works correctly
		const handleHash = (e: React.MouseEvent<HTMLAnchorElement>) => {
			e.preventDefault();
			const id = href.replace('#', '');
			document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
			window.history.replaceState(null, '', href);
			onClick?.();
		};
		return (
			<a href={href} className={className} style={style} onClick={handleHash}>
				{children}
			</a>
		);
	};

	return (
		<>
			<nav
				className={`${styles.nav} ${scrolled ? styles.scrolled : ''} ${menuOpen ? styles.open : ''}`}
			>
				<div className={styles.inner}>
					{bookPage ? (
						<Link href="/" className={styles.logo}>
							<Image
								src="/logo.svg"
								alt="The Property Room"
								width={400}
								height={400}
								priority
							/>
						</Link>
					) : (
						<a
						href="#top"
						className={styles.logo}
						onClick={(e) => {
							e.preventDefault();
							window.scrollTo({ top: 0, behavior: 'smooth' });
							window.history.replaceState(null, '', '/');
						}}
					>
							<Image
								src="/logo.svg"
								alt="The Property Room"
								width={400}
								height={400}
								priority
							/>
						</a>
					)}
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
							<NavLink key={l.href} href={l.href}>
								{l.label}
							</NavLink>
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
							<NavLink
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
							</NavLink>
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
