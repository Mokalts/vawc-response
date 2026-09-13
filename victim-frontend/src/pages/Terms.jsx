import React from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import BottomNavbar from '../components/BottomNavbar';
import TermsContent, { TERMS_SECTIONS } from '../components/TermsContent';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id='vawc-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
// Not 'vawc-terms-css': TermsModal already injects under that id, and whichever
// module loaded first would silently block the other's styles.
if (!document.getElementById('vawc-terms-page-css')) {
    const s = document.createElement('style'); s.id='vawc-terms-page-css';
    s.textContent = `
        .vt-toc a { transition: background-color 0.15s ease, color 0.15s ease; }
        .vt-toc a:hover { background: var(--surface-alt); color: var(--text); }
    `;
    document.head.appendChild(s);
}

const LAST_UPDATED = '13 September 2026';

const IcoArrow = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" stroke="var(--accent-text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/**
 * The privacy notice as a reading page, so it can be re-read at any time.
 * Laid out for reading rather than scanning a form: a heading block, a table of
 * contents that jumps to each section, and one reading column capped near 72
 * characters so lines stay easy to follow on a monitor.
 */
export default function Terms() {
    const navigate = useNavigate();

    const jump = (e, id) => {
        e.preventDefault();
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    };

    return (
        <div style={S.page}>
            <header style={S.topBar}>
                <button style={S.backBtn} onClick={() => navigate(-1)} aria-label="Go back"><IcoArrow /></button>
                <h1 style={S.title}>Terms &amp; Privacy</h1>
                <ThemeToggle size={44} />
            </header>

            <main style={S.content}>
                <div style={S.heading}>
                    <p style={S.kicker}>Republic Act 10173</p>
                    <h2 style={S.h}>Data Privacy Notice and Terms</h2>
                    <p style={S.updated}>Last updated {LAST_UPDATED}</p>
                </div>

                <nav className="vt-toc" aria-label="On this page" style={S.toc}>
                    <p style={S.tocLabel}>On this page</p>
                    <ol style={S.tocList}>
                        {TERMS_SECTIONS.map((s, i) => (
                            <li key={s.id}>
                                <a href={`#${s.id}`} onClick={(e) => jump(e, s.id)} style={S.tocLink}>
                                    <span style={S.tocNum} aria-hidden="true">{i + 1}</span>
                                    <span>{s.title}</span>
                                </a>
                            </li>
                        ))}
                    </ol>
                </nav>

                <article style={S.card}>
                    <TermsContent />
                </article>

                <p style={S.footNote}>
                    You accepted this notice when you created your account. You may withdraw consent or
                    request a copy of your records at any time by contacting the Barangay Palanginan Data
                    Privacy Officer.
                </p>
            </main>

            <BottomNavbar />
        </div>
    );
}

const FF = "'Lexend', sans-serif";
const S = {
    page:     { minHeight: '100vh', background: 'var(--page-grad)', color: 'var(--text)', display: 'flex', flexDirection: 'column', paddingBottom: 92, fontFamily: FF },
    topBar:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 100 },
    backBtn:  { width: 44, height: 44, borderRadius: 10, backgroundColor: 'var(--surface-tint)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    title:    { fontSize: 17, fontWeight: 700, color: 'var(--accent-text)', fontFamily: FF, margin: 0 },

    // One reading column. Every block below shares this left edge.
    content:  { padding: '26px 18px 20px', display: 'flex', flexDirection: 'column', gap: 18, width: '100%', maxWidth: 720, marginLeft: 'auto', marginRight: 'auto', boxSizing: 'border-box' },

    heading:  { padding: '0 2px' },
    kicker:   { margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-text)', fontFamily: FF },
    h:        { margin: '6px 0 0', fontSize: 'clamp(23px, 5.2vw, 30px)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15, color: 'var(--text)', fontFamily: FF, textWrap: 'balance' },
    updated:  { margin: '8px 0 0', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: FF },

    toc:      { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 14px 10px' },
    tocLabel: { margin: '0 0 6px 6px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: FF },
    tocList:  { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2px 12px' },
    tocLink:  { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '4px 8px', borderRadius: 8, color: 'var(--text-body)', textDecoration: 'none', fontSize: 13.5, lineHeight: 1.35, fontFamily: FF },
    tocNum:   { width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: 'var(--surface-tint)', color: 'var(--accent-text)', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },

    card:     { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 'clamp(20px, 5vw, 34px)', boxShadow: 'var(--card-shadow)' },

    // Left-aligned: a centred multi-line paragraph is hard to read, because
    // every line starts at a different place.
    footNote: { margin: '0 2px', fontSize: 12.5, lineHeight: 1.65, color: 'var(--text-muted)', textAlign: 'left', maxWidth: '72ch', fontFamily: FF },
};
