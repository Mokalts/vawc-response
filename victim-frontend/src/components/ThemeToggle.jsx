import React, { useState, useEffect } from 'react';

/**
 * Light/dark theme switch. Flips `data-theme` on <html>, persists to
 * localStorage, and broadcasts `vawc:theme` so any other toggle instances
 * stay in sync. The initial theme is applied pre-paint by a script in
 * public/index.html to avoid a flash of the wrong theme.
 */

const getTheme = () =>
    (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'light';

const IcoSun = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);
const IcoMoon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default function ThemeToggle({ size = 44 }) {
    const [theme, setTheme] = useState(getTheme());

    useEffect(() => {
        const sync = () => setTheme(getTheme());
        window.addEventListener('vawc:theme', sync);
        return () => window.removeEventListener('vawc:theme', sync);
    }, []);

    const toggle = () => {
        const next = getTheme() === 'dark' ? 'light' : 'dark';
        // Suppress every transition for the frame the tokens change in,
        // or each element animates to its new colour on its own timetable.
        const root = document.documentElement;
        root.classList.add('theme-flip');
        root.setAttribute('data-theme', next);
        void root.offsetWidth;          // lay out while transitions are off
        // The timer is the release that always runs; the frame callbacks only
        // get there sooner. rAF does not fire in a background tab, and a
        // suppression left on would kill every animation in the app.
        const lift = () => root.classList.remove('theme-flip');
        requestAnimationFrame(() => requestAnimationFrame(lift));
        setTimeout(lift, 120);
        try { localStorage.setItem('vawc_theme', next); } catch {}
        setTheme(next);
        window.dispatchEvent(new Event('vawc:theme'));
    };

    const isDark = theme === 'dark';
    return (
        <button
            type="button"
            className="vh-icon-btn"
            onClick={toggle}
            aria-label={isDark ? 'Lumipat sa light mode' : 'Lumipat sa dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
            style={{
                width: size, height: size, borderRadius: 14,
                background: 'transparent', border: 'none',
                color: 'var(--text)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
            }}
        >
            {isDark ? <IcoSun /> : <IcoMoon />}
        </button>
    );
}
