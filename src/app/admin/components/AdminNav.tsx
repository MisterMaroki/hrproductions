'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './AdminNav.module.css';

export default function AdminNav() {
	const pathname = usePathname();
	const router = useRouter();

	const handleLogout = async () => {
		await fetch('/api/admin/logout', { method: 'POST' });
		router.push('/admin/login');
	};

	return (
		<nav className={styles.nav}>
			<div className={styles.inner}>
				<span className={styles.brand}>PropertyRoom Admin</span>
				<div className={styles.links}>
					<Link
						href="/admin/calendar"
						className={`${styles.link} ${pathname === '/admin/calendar' ? styles.active : ''}`}
					>
						Calendar
					</Link>
					<Link
						href="/admin/discounts"
						className={`${styles.link} ${pathname === '/admin/discounts' ? styles.active : ''}`}
					>
						Discounts
					</Link>
					<button className={styles.logout} onClick={handleLogout}>
						Log Out
					</button>
				</div>
			</div>
		</nav>
	);
}
