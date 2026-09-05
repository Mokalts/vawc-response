import React, { useState, useEffect } from 'react';
import { COLORS } from '../theme';

/**
 * Admin light/dark theme switch. Flips `data-theme` on <html>, persists to
 * localStorage ('vawc_admin_theme'), and broadcasts 'vawc:admin-theme' so any
 * other instances stay in sync. Initial theme is applied pre-paint by a script
 * in public/index.html (default light).
 */

const getTheme = () =>
    (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'light';

const IcoSun = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);
const IcoMoon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default function ThemeToggle({ size = 36 }) {
    const [theme, setTheme] = useState(getTheme());

    useEffect(() => {
        const sync = () => setTheme(getTheme());
        window.addEventListener('vawc:admin-theme', sync);
        return () => window.removeEventListener('vawc:admin-theme', sync);
    }, []);

    const toggle = () => {
        const next = getTheme() === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('vawc_admin_theme', next); } catch {}
        setTheme(next);
        window.dispatchEvent(new Event('vawc:admin-theme'));
    };

    const isDark = theme === 'dark';
    return (
        <button
            type="button"
            className="adm-btn"
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
            style={{
                width: size, height: size, borderRadius: 8,
                background: COLORS.bgMuted, border: `1px solid ${COLORS.border}`,
                color: COLORS.primary, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            }}
        >
            {isDark ? <IcoSun /> : <IcoMoon />}
        </button>
    );
}
