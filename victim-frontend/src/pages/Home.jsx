import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavbar from '../components/BottomNavbar';
import SidebarMenu from '../components/SidebarMenu';
import SOSButton from '../components/SOSButton';
import api from '../api';

// ─── Font + CSS ───────────────────────────────────────────────────────────────
if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
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
        .vh-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(244,121,32,0.16) !important; }
        .vh-card:active { transform: scale(0.985); }
        .vh-hero-btn { transition: all 0.15s ease; }
        .vh-hero-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(0,0,0,0.18) !important; }
        .vh-hero-btn:active { transform: scale(0.97); }
        .vh-report-btn { transition: all 0.18s ease; }
        .vh-report-btn:hover { filter: brightness(1.05); transform: translateY(-1px); box-shadow: 0 10px 24px rgba(196,94,16,0.34) !important; }
        .vh-report-btn:active { transform: scale(0.98); }
        .vh-icon-btn { transition: all 0.15s ease; }
        .vh-icon-btn:hover { background: #FFF3E0 !important; transform: translateY(-1px); }
        .vh-icon-btn:active { transform: scale(0.95); }
        .bell-ring { animation: bellRing 0.6s ease; }
        .awareness-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 600px) { .awareness-grid { grid-template-columns: 1fr; } }
        @media (min-width: 601px) and (max-width: 900px) { .awareness-grid { grid-template-columns: 1fr 1fr; } }
    `;
    document.head.appendChild(s);
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IcoMenu   = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="#C45E10" strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoArrow  = ({ c = '#fff' }) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M13 6L19 12L13 18" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoAlert  = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#EC4899" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="#EC4899" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoDoc    = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#7B2D8B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#7B2D8B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoHands  = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#059669" strokeWidth="1.8" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" /></svg>);
const IcoBell   = ({ c = '#F47920', size = 18 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoLock   = ({ c = '#C45E10' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="4" y="11" width="16" height="10" rx="2" stroke={c} strokeWidth="1.9" /><path d="M8 11V7a4 4 0 018 0v4" stroke={c} strokeWidth="1.9" strokeLinecap="round" /></svg>);
const IcoScale  = ({ c = '#C45E10' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 006 0L5 7zm14 0l-3 6a3 3 0 006 0l-3-6z" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoClock  = ({ c = '#C45E10' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.9" /><path d="M12 7v5l3 2" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const awarenessItems = [
    { icon: <IcoAlert />, iconBg: '#FDF2F8', section: 'signs', tag: 'RA 9262',     title: 'Recognize Abuse', desc: 'Identify the signs of VAWC and understand what counts as abuse.', accent: '#EC4899' },
    { icon: <IcoDoc />,   iconBg: '#F3E5F5', section: 'todo',  tag: 'Legal Steps',  title: 'Your Remedies',   desc: 'Step-by-step actions you can take to protect yourself.',            accent: '#7B2D8B' },
    { icon: <IcoHands />, iconBg: '#ECFDF5', section: 'where', tag: 'Agencies',     title: 'Seek Support',    desc: 'Where to file a report and get professional help.',                 accent: '#059669' },
];

const reassurance = [
    { icon: <IcoLock />,  label: 'Confidential', sub: 'Encrypted & private' },
    { icon: <IcoScale />, label: 'Free',         sub: 'Legal aid (PAO)' },
    { icon: <IcoClock />, label: '15 days',      sub: 'Protection Order' },
];

function Home() {
    const navigate = useNavigate();
    const [showSidebar, setShowSidebar] = useState(false);
    const [notifCount,  setNotifCount]  = useState(0);
    const [bellRinging, setBellRinging] = useState(false);

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
                             style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                             onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                    <span style={S.appName}>VAWC-Response</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="vh-icon-btn" style={S.notifBtn} onClick={handleNotifClick}
                        title={notifCount > 0 ? `${notifCount} case update${notifCount > 1 ? 's' : ''}` : 'No new updates'}>
                        <span className={bellRinging ? 'bell-ring' : ''} style={{ display: 'flex' }}>
                            <IcoBell c={notifCount > 0 ? '#F47920' : '#94A3B8'} size={20} />
                        </span>
                        {notifCount > 0 && <span style={S.notifBadge}>{notifCount > 9 ? '9+' : notifCount}</span>}
                    </button>
                    <button className="vh-icon-btn" style={S.menuBtn} onClick={() => setShowSidebar(true)}>
                        <IcoMenu />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main style={S.content}>

                {/* Status update banner */}
                {notifCount > 0 && (
                    <div className="vh-anim" onClick={handleNotifClick} style={S.notifBanner}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={S.notifBannerIcon}><IcoBell c="#F47920" size={16} /></div>
                            <div>
                                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#C45E10', fontFamily: FF }}>
                                    {notifCount} new update{notifCount > 1 ? 's' : ''} from the barangay
                                </p>
                                <p style={{ margin: 0, fontSize: 12, color: '#E8843C', fontFamily: FF }}>
                                    Please check your messages in My Reports, or your email.
                                </p>
                            </div>
                        </div>
                        <IcoArrow c="#F47920" />
                    </div>
                )}

                {/* Hero — calm & reassuring */}
                <section className="vh-anim" style={S.hero}>
                    <div style={S.heroBlob} />
                    <div style={S.heroBlob2} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <span style={S.heroHello}>Hello, {firstName}</span>
                        <h2 style={S.heroTitle}>You are not alone.</h2>
                        <p style={S.heroText}>
                            A safe and confidential space to report incidents and seek support under Republic Act 9262.
                        </p>
                        <button className="vh-hero-btn" style={S.heroBtn} onClick={() => navigate('/report')}>
                            Report an Incident <IcoArrow c="#4A1259" />
                        </button>
                    </div>
                </section>

                {/* Emergency SOS — always accessible, works without login */}
                <div className="vh-anim" style={{ animationDelay: '0.05s' }}>
                    <SOSButton variant="block" />
                </div>

                {/* Reassurance chips */}
                <div className="vh-anim" style={{ ...S.chipRow, animationDelay: '0.1s' }}>
                    {reassurance.map((r, i) => (
                        <div key={i} style={S.chip}>
                            <div style={S.chipIcon}>{r.icon}</div>
                            <div>
                                <p style={S.chipLabel}>{r.label}</p>
                                <p style={S.chipSub}>{r.sub}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Awareness section */}
                <div style={S.sectionHead}>
                    <div>
                        <p style={S.sectionLabel}>Legal Awareness</p>
                        <p style={S.sectionSub}>Know your rights under Republic Act 9262</p>
                    </div>
                </div>

                <div className="awareness-grid">
                    {awarenessItems.map(item => (
                        <div key={item.section} className="vh-card" style={S.awareCard}
                            onClick={() => navigate(`/awareness?section=${item.section}`)}>
                            <div style={{ ...S.awareIconBox, backgroundColor: item.iconBg }}>{item.icon}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                                <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: item.accent }} />
                                <span style={{ ...S.awareTag, color: item.accent }}>{item.tag}</span>
                            </div>
                            <p style={{ ...S.awareTitle, color: item.accent }}>{item.title}</p>
                            <p style={S.awareDesc}>{item.desc}</p>
                            <div style={{ ...S.awareBtn, color: item.accent }}>
                                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: FF }}>Learn more</span>
                                <IcoArrow c={item.accent} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom report CTA */}
                <button className="vh-report-btn" style={S.reportBtn} onClick={() => navigate('/report')}>
                    Report an Incident Now
                </button>

            </main>

            <BottomNavbar active="home" />
        </div>
    );
}

const FF = "'DM Sans', sans-serif";
const S = {
    page:        { minHeight: '100vh', background: 'linear-gradient(180deg, #FFF9F3 0%, #FFF3E0 100%)', display: 'flex', flexDirection: 'column', paddingBottom: 80, fontFamily: FF },
    topBar:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 18px', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #FFE9D6', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 14px rgba(244,121,32,0.06)' },
    topBarLeft:  { display: 'flex', alignItems: 'center', gap: 10 },
    logoIcon:    { width: 40, height: 40, borderRadius: '50%', backgroundColor: '#fff', border: '2px solid #FFCC99', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3, boxSizing: 'border-box', overflow: 'hidden' },
    appName:     { fontSize: 17, fontWeight: 800, color: '#C45E10', fontFamily: FF, letterSpacing: '-0.3px' },
    menuBtn:     { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF3E0', border: '1.5px solid #FFE4CC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    notifBtn:    { position: 'relative', width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', border: '1.5px solid #FFE4CC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    notifBadge:  { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 9999, backgroundColor: '#F47920', color: '#fff', fontSize: 9.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid #fff', fontFamily: FF },

    notifBanner:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', border: '1.5px solid #FFE4CC', borderRadius: 16, padding: '14px 16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(244,121,32,0.1)' },
    notifBannerIcon:{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

    content:     { padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 16 },

    // Hero
    hero:        { position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #7B2D8B 0%, #4A1259 100%)', borderRadius: 24, padding: '26px 22px', boxShadow: '0 10px 30px rgba(74,18,89,0.3)' },
    heroBlob:    { position: 'absolute', top: -40, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', animation: 'floatBlob 6s ease-in-out infinite' },
    heroBlob2:   { position: 'absolute', bottom: -50, left: -20, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.09)' },
    heroHello:   { display: 'inline-block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.92)', marginBottom: 8, fontFamily: FF },
    heroTitle:   { fontSize: 25, fontWeight: 800, color: '#fff', margin: '0 0 8px', fontFamily: FF, letterSpacing: '-0.5px' },
    heroText:    { fontSize: 13.5, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6, margin: '0 0 18px', fontFamily: FF, maxWidth: 340 },
    heroBtn:     { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', backgroundColor: '#fff', color: '#4A1259', fontSize: 14, fontWeight: 800, border: 'none', borderRadius: 9999, cursor: 'pointer', fontFamily: FF, boxShadow: '0 4px 14px rgba(0,0,0,0.18)' },

    // Reassurance chips
    chipRow:     { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 },
    chip:        { display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#fff', border: '1px solid #FFE9D6', borderRadius: 14, padding: '11px 12px', boxShadow: '0 2px 10px rgba(244,121,32,0.05)' },
    chipIcon:    { width: 28, height: 28, borderRadius: 9, backgroundColor: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    chipLabel:   { margin: 0, fontSize: 13, fontWeight: 800, color: '#C45E10', fontFamily: FF, lineHeight: 1.1 },
    chipSub:     { margin: '2px 0 0', fontSize: 10, color: '#94A3B8', fontFamily: FF, lineHeight: 1.2 },

    sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 4 },
    sectionLabel:{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: '0 0 2px', fontFamily: FF, letterSpacing: '-0.3px' },
    sectionSub:  { fontSize: 12.5, color: '#94A3B8', margin: 0, fontFamily: FF },

    awareCard:   { backgroundColor: '#fff', borderRadius: 18, padding: '16px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5, border: '1px solid #FFF0E1', boxShadow: '0 4px 18px rgba(244,121,32,0.07)' },
    awareIconBox:{ width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    awareTag:    { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.4px', fontFamily: FF },
    awareTitle:  { fontSize: 14, fontWeight: 800, lineHeight: 1.3, margin: 0, fontFamily: FF },
    awareDesc:   { fontSize: 11.5, color: '#64748B', lineHeight: 1.5, flex: 1, margin: '2px 0 0', fontFamily: FF },
    awareBtn:    { display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, width: 'fit-content' },

    reportBtn:   { width: '100%', padding: 16, background: 'linear-gradient(135deg, #F47920 0%, #E8641C 100%)', color: '#fff', fontSize: 16, fontWeight: 800, border: 'none', borderRadius: 16, cursor: 'pointer', fontFamily: FF, boxShadow: '0 8px 20px rgba(196,94,16,0.3)', letterSpacing: '-0.2px' },
};

export default Home;
