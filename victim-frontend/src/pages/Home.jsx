import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavbar from '../components/BottomNavbar';
import SidebarMenu from '../components/SidebarMenu';
import SOSButton from '../components/SOSButton';
import OnboardingTour from '../components/OnboardingTour';
import ThemeToggle from '../components/ThemeToggle';
import api from '../api';

// First-time walkthrough steps (Tagalog)
const TOUR_STEPS = [
    { title: 'Maligayang pagdating!', text: 'Ipapakita namin ang mga pangunahing bahagi ng app. Mabilis lang ito.' },
    { target: '[data-tour="report"]',    title: 'Mag-report ng insidente', text: 'Pindutin ito para magsumite ng report. Ligtas at kumpidensyal ang lahat ng iyong impormasyon.' },
    { target: '[data-tour="sos"]',       title: 'Mga Hotline',              text: 'Kung may agarang panganib, dito ka tumawag sa pulis, VAWC desk, at DSWD. Gumagana ito kahit hindi naka-log in.' },
    { target: '[data-tour="notif"]',     title: 'Mga Abiso',                text: 'Dito lalabas ang mga update at mensahe mula sa barangay VAWC office.' },
    { target: '[data-tour="myreports"]', title: 'Subaybayan ang Kaso',      text: 'Tingnan ang status ng iyong report at mga mensahe mula sa barangay dito.' },
    { target: '[data-tour="menu"]',      title: 'Menu',                     text: 'Dito matatagpuan ang iyong profile, ang gabay, at iba pang settings.' },
    { title: 'Handa ka na!', text: 'Pwede mong ulitin ang gabay na ito anumang oras sa Menu → Paano Gamitin. Salamat!' },
];

// ─── Font + CSS ───────────────────────────────────────────────────────────────
if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-home-css')) {
    const s = document.createElement('style'); s.id = 'vawc-home-css';
    s.textContent = `
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes floatBlob { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-6px,6px)} }
        @keyframes bellRing {
            0%,100% { transform: rotate(0deg); }
            15% { transform: rotate(18deg); } 30% { transform: rotate(-16deg); }
            45% { transform: rotate(12deg); } 60% { transform: rotate(-8deg); }
            75% { transform: rotate(4deg); }
        }
        .vh-anim { animation: fadeUp 0.4s ease both; }
        .vh-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .vh-card:hover { transform: translateY(-3px); box-shadow: var(--card-shadow-strong) !important; }
        .vh-card:active { transform: scale(0.985); }
        .vh-hero-btn { transition: all 0.15s ease; }
        .vh-hero-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(0,0,0,0.18) !important; }
        .vh-hero-btn:active { transform: scale(0.97); }
        .vh-report-btn { transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease; }
        .vh-report-btn:hover { filter: brightness(1.04); transform: translateY(-2px); box-shadow: 0 16px 32px rgba(196,94,16,0.4), inset 0 1px 0 rgba(255,255,255,0.3) !important; }
        .vh-report-btn:active { transform: translateY(0) scale(0.99); }
        /* Arrow nudges on hover: 3px of feedback, no layout shift. */
        .vh-report-arrow { transition: transform 0.18s ease; }
        .vh-report-btn:hover .vh-report-arrow { transform: translateX(3px); }
        /* Soft highlight that drifts across the CTA so it catches the eye without
           blinking at the user. Stops entirely under reduced-motion. */
        .vh-report-glow {
            position: absolute; top: -60%; left: -30%; width: 45%; height: 220%;
            background: linear-gradient(100deg, transparent, rgba(255,255,255,0.22), transparent);
            transform: translateX(-120%); pointer-events: none;
            animation: reportSheen 5.5s ease-in-out 1.5s infinite;
        }
        @keyframes reportSheen {
            0%, 62% { transform: translateX(-120%); }
            88%, 100% { transform: translateX(420%); }
        }
        @media (prefers-reduced-motion: reduce) { .vh-report-glow { display: none; } }
        .vh-report-btn:hover .vh-report-glow { animation-duration: 2.4s; }
        .vh-icon-btn { transition: all 0.15s ease; }
        .vh-icon-btn:hover { filter: brightness(0.97); transform: translateY(-1px); }
        .vh-icon-btn:active { transform: scale(0.95); }
        .bell-ring { animation: bellRing 0.6s ease; }
        .awareness-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 600px) { .awareness-grid { grid-template-columns: 1fr; } }
        @media (min-width: 601px) and (max-width: 900px) { .awareness-grid { grid-template-columns: 1fr 1fr; } }

        /* Scroll reveal. Elements start shifted and fade in when they enter the
           viewport; the observer adds .is-in once and never removes it, so the
           page does not flicker when scrolling back up. */
        .vh-reveal { opacity: 0; transform: translateY(18px); transition: opacity 0.55s cubic-bezier(0.22,1,0.36,1), transform 0.55s cubic-bezier(0.22,1,0.36,1); }
        .vh-reveal.is-in { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) {
            .vh-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
        }
        /* Card hover: the glyph lifts slightly and the arrow slides */
        .vh-card-glyph { transition: transform 0.25s cubic-bezier(0.22,1,0.36,1); }
        .vh-card:hover .vh-card-glyph { transform: translateY(-3px) scale(1.04); }
        .vh-card-arrow { transition: transform 0.2s ease; }
        .vh-card:hover .vh-card-arrow { transform: translateX(3px); }
        /* Reassurance rows: a quiet wash on hover, no movement */
        .vh-chip { transition: background 0.18s ease; }
        .vh-chip:hover { background: var(--surface-alt); }

        /* ── Layout: mobile = single column (unchanged); desktop = two-column ── */
        .vh-top  { display: flex; flex-direction: column; gap: 16px; }
        .vh-side { display: flex; flex-direction: column; gap: 16px; }
        @media (min-width: 900px) {
            .vh-content { max-width: 1060px; margin-left: auto; margin-right: auto; width: 100%; }
            .vh-top { display: grid; grid-template-columns: 1.35fr 1fr; gap: 18px; align-items: stretch; }
            .vh-side { justify-content: space-between; }
            .vh-report-btn { max-width: 420px; margin-left: auto; margin-right: auto; display: block; }
            .vh-sectionhead { margin-top: 6px; }
            /* Roomier reassurance rows beside the hero on desktop */
            .vh-chip { padding: 17px 20px !important; gap: 15px !important; }
            .vh-chipicon { width: 40px !important; height: 40px !important; border-radius: 12px !important; }
            .vh-chiplabel { font-size: 17px !important; }
            .vh-chipsub { font-size: 12.5px !important; }
            .vh-reassure { flex: 1; display: flex; flex-direction: column; justify-content: center; }
        }
    `;
    document.head.appendChild(s);
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IcoMenu   = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="#C45E10" strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoArrow  = ({ c = '#fff' }) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M13 6L19 12L13 18" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoFile   = ({ c = '#fff' }) => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2v6h6" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 14.5l2 2 4-4.5" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>);
// ── Monochrome glyphs ────────────────────────────────────────────────────────
// Every icon draws with `currentColor`, so it inherits the theme's text colour
// and reads as black-on-light / white-on-dark with no per-icon palette. The
// shapes are drawn for this app rather than picked from a stock set: a lens
// over a warning for spotting abuse, a staircase for step-by-step remedies, a
// pin holding a heart for where to find help.
const SW = 1.7;
const Svg = ({ size = 22, children }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
// Recognize Abuse — a lens examining a warning mark
const IcoAlert  = ({ size }) => (<Svg size={size}><circle cx="10.5" cy="10.5" r="7" /><path d="M20.5 20.5l-5-5" /><path d="M10.5 7.4v3.6M10.5 13.7h.01" /></Svg>);
// Your Remedies — a checklist of actions she can take
const IcoDoc    = ({ size }) => (<Svg size={size}><path d="M10.5 6.8h9.5M10.5 12h9.5M10.5 17.2h9.5" /><path d="M3.6 6.6l1.5 1.5 2.6-2.8M3.6 11.8l1.5 1.5 2.6-2.8M3.6 17l1.5 1.5 2.6-2.8" /></Svg>);
// Seek Support — a place that holds care
const IcoHands  = ({ size }) => (<Svg size={size}><path d="M12 21.5s7-5.4 7-10.3A7 7 0 105 11.2c0 4.9 7 10.3 7 10.3z" /><path d="M14.2 9.5a1.75 1.75 0 00-2.2.35 1.75 1.75 0 00-2.2-.35 1.75 1.75 0 00-.3 2.4L12 14.6l2.5-2.7a1.75 1.75 0 00-.3-2.4z" /></Svg>);
const IcoBell   = ({ c = '#F47920', size = 18 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
// Confidential — a filed record sealed with a keyhole, not a generic padlock
const IcoLock   = ({ size = 18 }) => (<Svg size={size}><path d="M14 2.8H6.8A1.8 1.8 0 005 4.6v14.8a1.8 1.8 0 001.8 1.8h10.4a1.8 1.8 0 001.8-1.8V7.8z" /><path d="M14 2.8v5h5" /><circle cx="12" cy="13.4" r="1.6" /><path d="M12 15v2.2" /></Svg>);
// Free — no peso attached
const IcoScale  = ({ size = 18 }) => (<Svg size={size}><circle cx="12" cy="12" r="8.8" /><path d="M10 16.4V8.2h3.1a2.4 2.4 0 010 4.9H10" /><path d="M8.3 11.5h5.6" /><path d="M5.8 18.2L18.2 5.8" /></Svg>);
// 15 days — a dated period that carries protection
const IcoClock  = ({ size = 18 }) => (<Svg size={size}><rect x="3.2" y="5" width="17.6" height="15.8" rx="2" /><path d="M8 3v4M16 3v4M3.2 10h17.6" /><path d="M12 12.6l2.9 1v2.2c0 1.9-2.9 3.2-2.9 3.2s-2.9-1.3-2.9-3.2v-2.2z" /></Svg>);

// `tint` colours only the card's preview panel, never the glyph — the icon
// itself always renders in the theme's text colour.
const awarenessItems = [
    { Icon: IcoAlert, tint: 'var(--tint-pink)',   section: 'signs', tag: 'RA 9262',     title: 'Recognize Abuse', desc: 'Identify the signs of VAWC and understand what counts as abuse.' },
    { Icon: IcoDoc,   tint: 'var(--tint-purple)', section: 'todo',  tag: 'Legal Steps', title: 'Your Remedies',   desc: 'Step-by-step actions you can take to protect yourself.' },
    { Icon: IcoHands, tint: 'var(--tint-green)',  section: 'where', tag: 'Agencies',    title: 'Seek Support',    desc: 'Where to file a report and get professional help.' },
];

const reassurance = [
    { Icon: IcoLock,  label: 'Confidential', sub: 'Encrypted and private' },
    { Icon: IcoScale, label: 'Free',         sub: 'Legal aid through PAO' },
    { Icon: IcoClock, label: '15 days',      sub: 'Protection Order validity' },
];

function Home() {
    const navigate = useNavigate();
    const [showSidebar, setShowSidebar] = useState(false);
    const [notifCount,  setNotifCount]  = useState(0);
    const [bellRinging, setBellRinging] = useState(false);
    const [runTour,     setRunTour]     = useState(false);

    // Reveal-on-scroll. One observer for every .vh-reveal element; each is
    // unobserved once shown so scrolling back up does not replay it. If the
    // browser has no IntersectionObserver, everything is shown immediately
    // rather than left invisible.
    useEffect(() => {
        const nodes = Array.from(document.querySelectorAll('.vh-reveal'));
        if (!nodes.length) return;
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (reduced || typeof IntersectionObserver === 'undefined') {
            nodes.forEach(n => n.classList.add('is-in'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        nodes.forEach(n => io.observe(n));
        return () => io.disconnect();
    }, []);

    // First-time walkthrough: auto-run once, and allow replay via a custom event.
    useEffect(() => {
        let timer = null;
        if (!localStorage.getItem('vawc_home_tour_v1')) {
            timer = setTimeout(() => setRunTour(true), 600);
        }
        const onReplay = () => setRunTour(true);
        window.addEventListener('vawc:start-tour', onReplay);
        return () => { window.removeEventListener('vawc:start-tour', onReplay); if (timer) clearTimeout(timer); };
    }, []);

    const endTour = () => { localStorage.setItem('vawc_home_tour_v1', '1'); setRunTour(false); };

    const user      = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
    const firstName = user.first_name || 'there';

    useEffect(() => {
        api.get('/cases/')
            .then(res => {
                const updates = (res.data || []).filter(c => c.has_status_update).length;
                setNotifCount(updates);
                if (updates > 0) {
                    setTimeout(() => setBellRinging(true), 600);
                    setTimeout(() => setBellRinging(false), 1200);
                }
            })
            .catch(() => {});
    }, []);

    const handleNotifClick = () => navigate('/my-reports');

    return (
        <div style={S.page}>
            <SidebarMenu isOpen={showSidebar} onClose={() => setShowSidebar(false)} />

            {/* Top bar */}
            <header style={S.topBar}>
                <div style={S.topBarLeft}>
                    <div style={S.logoIcon}>
                        <img src="/barangay-logo.png" alt="Barangay Palanginan Seal"
                             style={S.logoImg}
                             onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                    <span style={S.appName}>VAWC-Response</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ThemeToggle size={44} />
                    <button data-tour="notif" className="vh-icon-btn" style={S.notifBtn} onClick={handleNotifClick}
                        aria-label={notifCount > 0 ? `Mga abiso: ${notifCount} update sa iyong kaso` : 'Mga abiso: walang bagong update'}
                        title={notifCount > 0 ? `${notifCount} case update${notifCount > 1 ? 's' : ''}` : 'No new updates'}>
                        <span className={bellRinging ? 'bell-ring' : ''} style={{ display: 'flex' }}>
                            <IcoBell c={notifCount > 0 ? '#F47920' : '#64748B'} size={20} />
                        </span>
                        {notifCount > 0 && <span style={S.notifBadge}>{notifCount > 9 ? '9+' : notifCount}</span>}
                    </button>
                    <button data-tour="menu" className="vh-icon-btn" style={S.menuBtn} onClick={() => setShowSidebar(true)}
                        aria-label="Buksan ang menu">
                        <IcoMenu />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="vh-content" style={S.content}>

                {/* Status update banner */}
                {notifCount > 0 && (
                    <div className="vh-anim" role="button" tabIndex={0} onClick={handleNotifClick}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNotifClick(); } }}
                        aria-label={`${notifCount} bagong update mula sa barangay, buksan ang My Reports`}
                        style={S.notifBanner}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={S.notifBannerIcon}><IcoBell c="#F47920" size={16} /></div>
                            <div>
                                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--accent-text)', fontFamily: FF }}>
                                    {notifCount} new update{notifCount > 1 ? 's' : ''} from the barangay
                                </p>
                                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', fontFamily: FF }}>
                                    Please check your messages in My Reports, or your email.
                                </p>
                            </div>
                        </div>
                        <IcoArrow c="var(--accent-text)" />
                    </div>
                )}

                {/* Top block: hero + (SOS + chips). Single column on phone, 2-col on desktop. */}
                <div className="vh-top">
                    {/* Hero, calm & reassuring */}
                    <section className="vh-anim" style={S.hero}>
                        <div style={S.heroBlob} />
                        <div style={S.heroBlob2} />
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <span style={S.heroHello}>Hello, {firstName}</span>
                            <h2 style={S.heroTitle}>You are not alone.</h2>
                            <p style={S.heroText}>
                                A safe and confidential space to report incidents and seek support under Republic Act 9262.
                            </p>
                            <button data-tour="report" className="vh-hero-btn" style={S.heroBtn} onClick={() => navigate('/report')}>
                                Report an Incident <IcoArrow c="#4A1259" />
                            </button>
                        </div>
                    </section>

                    <div className="vh-side">
                        {/* Emergency SOS, always accessible, works without login */}
                        <div data-tour="sos" className="vh-anim" style={{ animationDelay: '0.05s' }}>
                            <SOSButton variant="block" />
                        </div>

                        {/* Reassurance. One panel with hairline rows rather than three
                            floating boxes: fewer edges, and the eye reads it as a single
                            set of guarantees instead of three unrelated cards. */}
                        <div className="vh-anim vh-reassure" style={{ ...S.chipRow, animationDelay: '0.1s' }}>
                            {reassurance.map((r, i) => (
                                <div key={r.label} className="vh-chip" style={{ ...S.chip, borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)' }}>
                                    <span className="vh-chipicon" style={S.chipIcon}><r.Icon size={18} /></span>
                                    <div style={{ minWidth: 0 }}>
                                        <p className="vh-chiplabel" style={S.chipLabel}>{r.label}</p>
                                        <p className="vh-chipsub" style={S.chipSub}>{r.sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Awareness section */}
                <div className="vh-sectionhead vh-reveal" style={S.sectionHead}>
                    <div>
                        <p style={S.sectionLabel}>Legal Awareness</p>
                        <p style={S.sectionSub}>Know your rights under Republic Act 9262</p>
                    </div>
                </div>

                <div className="awareness-grid">
                    {awarenessItems.map((item, i) => (
                        <div key={item.section} className="vh-card vh-reveal" style={{ ...S.awareCard, transitionDelay: `${i * 70}ms` }}
                            role="button" tabIndex={0}
                            aria-label={`${item.title}: ${item.desc}`}
                            onClick={() => navigate(`/awareness?section=${item.section}`)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/awareness?section=${item.section}`); } }}>
                            {/* Preview panel: the tint carries the category, the glyph stays monochrome */}
                            <div style={{ ...S.awarePreview, background: item.tint }}>
                                <span className="vh-card-glyph" style={S.awareGlyph}><item.Icon size={34} /></span>
                                <span style={S.awareTag}>{item.tag}</span>
                            </div>
                            <div style={S.awareBody}>
                                <p style={S.awareTitle}>{item.title}</p>
                                <p style={S.awareDesc}>{item.desc}</p>
                                <span style={S.awareBtn}>
                                    Learn more
                                    <span className="vh-card-arrow" style={{ display: 'inline-flex' }}><IcoArrow c="currentColor" /></span>
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom report CTA */}
                <div>
                    <button className="vh-report-btn vh-reveal" style={S.reportBtn} onClick={() => navigate('/report')}>
                        <span className="vh-report-glow" aria-hidden="true" />
                        <span style={S.reportLabel}>
                            <IcoFile />
                            Report an Incident
                            <span className="vh-report-arrow" style={{ display: 'inline-flex' }}><IcoArrow c="#fff" /></span>
                        </span>
                    </button>
                    <p style={S.reportCaption}>Takes a few minutes. Confidential under Republic Act 9262.</p>
                </div>

            </main>

            <BottomNavbar active="home" />

            <OnboardingTour steps={TOUR_STEPS} run={runTour} onClose={endTour} />
        </div>
    );
}

const FF = "'Lexend', sans-serif";
const S = {
    page:        { minHeight: '100vh', background: 'var(--page-grad)', display: 'flex', flexDirection: 'column', paddingBottom: 92, fontFamily: FF, color: 'var(--text)' },
    topBar:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', backgroundColor: 'var(--topbar)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 100 },
    topBarLeft:  { display: 'flex', alignItems: 'center', gap: 10 },
    logoIcon:    { width: 46, height: 46, borderRadius: '50%', backgroundColor: '#fff', border: '2px solid #FFCC99', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, boxSizing: 'border-box', overflow: 'hidden' },
    // The seal PNG has white padding baked around the artwork, so a plain fit
    // leaves it small and sitting low inside the ring. Same correction as the
    // sign-in and admin sidebar logos.
    logoImg:     { width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scale(1.16) translateY(1%)', transformOrigin: 'center' },
    appName:     { fontSize: 17, fontWeight: 700, color: 'var(--accent-text)', fontFamily: FF, letterSpacing: '-0.3px' },
    menuBtn:     { width: 44, height: 44, borderRadius: 12, backgroundColor: 'var(--surface-tint)', border: '1px solid var(--border)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    notifBtn:    { position: 'relative', width: 44, height: 44, borderRadius: 12, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    notifBadge:  { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 9999, backgroundColor: '#F47920', color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid var(--surface)', fontFamily: FF },

    notifBanner:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '14px 16px', cursor: 'pointer', boxShadow: 'var(--card-shadow)' },
    notifBannerIcon:{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'var(--surface-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

    content:     { padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 16 },

    // Hero, brand purple (works on both themes)
    hero:        { position: 'relative', overflow: 'hidden', background: 'linear-gradient(150deg, #8A3C9C 0%, #4A1259 88%)', borderRadius: 'var(--radius-card)', padding: '28px 22px', boxShadow: '0 12px 34px rgba(74,18,89,0.34)' },
    heroBlob:    { position: 'absolute', top: -46, right: -46, width: 150, height: 150, borderRadius: '50%', border: '22px solid rgba(255,255,255,0.08)' },
    heroBlob2:   { position: 'absolute', bottom: -50, left: -20, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' },
    heroHello:   { display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)', marginBottom: 9, fontFamily: FF },
    heroTitle:   { fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 9px', fontFamily: FF, letterSpacing: '-0.4px', lineHeight: 1.12 },
    heroText:    { fontSize: 13.5, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, margin: '0 0 18px', fontFamily: FF, maxWidth: 320 },
    heroBtn:     { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', backgroundColor: '#fff', color: '#4A1259', fontSize: 14, fontWeight: 700, border: 'none', borderRadius: 14, cursor: 'pointer', fontFamily: FF, boxShadow: '0 8px 20px rgba(0,0,0,0.18)' },

    // Reassurance chips — clean vertical "trust badges" on phone (icon on top,
    // centered); desktop overrides to a bigger horizontal card (see injected CSS).
    // One panel, three hairline-separated rows. The left accent rule is the only
    // colour; the glyphs stay in the theme's text colour.
    chipRow:     { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid #F47920', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--card-shadow)' },
    chip:        { display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px' },
    chipIcon:    { width: 34, height: 34, borderRadius: 10, backgroundColor: 'var(--surface-tint)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    chipLabel:   { margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--text)', fontFamily: FF, lineHeight: 1.2, overflowWrap: 'break-word' },
    chipSub:     { margin: '2px 0 0', fontSize: 11.5, color: 'var(--text-muted)', fontFamily: FF, lineHeight: 1.35, overflowWrap: 'break-word' },

    sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 4 },
    sectionLabel:{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px', fontFamily: FF, letterSpacing: '-0.3px' },
    sectionSub:  { fontSize: 12.5, color: 'var(--text-muted)', margin: 0, fontFamily: FF },

    // Preview panel on top, content below — the reference layout.
    awareCard:   { backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-card)', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' },
    awarePreview:{ position: 'relative', height: 116, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    awareGlyph:  { color: 'var(--text)', display: 'inline-flex', opacity: 0.85 },
    awareTag:    { position: 'absolute', top: 10, left: 12, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-body)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9999, padding: '3px 9px', fontFamily: FF },
    awareBody:   { padding: '14px 15px 16px', display: 'flex', flexDirection: 'column', flex: 1 },
    awareTitle:  { fontSize: 15, fontWeight: 800, letterSpacing: '-0.2px', lineHeight: 1.3, margin: 0, color: 'var(--text)', fontFamily: FF },
    awareDesc:   { fontSize: 12, color: 'var(--text-body)', lineHeight: 1.55, flex: 1, margin: '4px 0 0', fontFamily: FF },
    awareBtn:    { display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, width: 'fit-content', fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', fontFamily: FF },

    // Matches the Hotlines button's shape and height so the two read as one
    // family; only the colour separates report from emergency.
    reportBtn:   { position: 'relative', overflow: 'hidden', width: '100%', minHeight: 56, padding: '0 20px', background: 'linear-gradient(180deg, #F47920 0%, #C45E10 100%)', color: '#fff', border: 'none', borderRadius: 14, cursor: 'pointer', touchAction: 'manipulation', fontFamily: FF, boxShadow: '0 10px 24px rgba(196,94,16,0.34), inset 0 1px 0 rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    reportLabel: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.2px', fontFamily: FF },
    reportCaption:{ margin: '9px 2px 0', fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-muted)', textAlign: 'center', fontFamily: FF },
};

export default Home;
