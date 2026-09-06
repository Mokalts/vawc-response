import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/api';
import { COLORS, TEXT, GLOBAL_CSS } from '../theme';
import { ConfirmHost } from './ConfirmDialog';
import ThemeToggle from './ThemeToggle';

// ─── Inject global styles once ────────────────────────────────────────────────
if (!document.getElementById('vawc-global-css')) {
    const s = document.createElement('style');
    s.id = 'vawc-global-css';
    s.textContent = GLOBAL_CSS + `
        .vawc-nav-btn { transition: background 0.15s ease, transform 0.15s ease; }
        .vawc-nav-btn:hover:not(.active) { background: rgba(255,255,255,0.06) !important; }
        .vawc-nav-btn.active { background: rgba(244,121,32,0.18) !important; }
        .vawc-logout:hover { background: rgba(123,45,139,0.08) !important; }
        .vawc-logout { transition: background 0.15s ease; }
        @keyframes burstPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(244,121,32,0.65); }
            50%      { box-shadow: 0 0 0 6px rgba(244,121,32,0); }
        }
        .burst-dot { animation: burstPulse 1.4s infinite; }

        /* Page + tab transitions */
        @keyframes pageEnter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes tabFade   { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .page-enter { animation: pageEnter 0.30s cubic-bezier(0.22, 1, 0.36, 1); }
        .tab-fade   { animation: tabFade 0.22s ease; }
        @media (prefers-reduced-motion: reduce) {
            .page-enter, .tab-fade { animation: none !important; }
        }
    `;
    document.head.appendChild(s);
}

const getAdmin = () => {
    try { return JSON.parse(localStorage.getItem('admin_user')) || {}; }
    catch { return {}; }
};

// Navigation uses the app font (Lexend).
const NAVFONT = "'Lexend', sans-serif";

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ico = ({ d, size = 18, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d={d} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const IcoMulti = ({ children, size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">{children}</svg>
);

const IcoDashboard = ({ size = 16, color = 'currentColor' }) => (
    <IcoMulti size={size}>
        <rect x="3" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="1.8" />
        <rect x="14" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="1.8" />
        <rect x="3" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="1.8" />
        <rect x="14" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="1.8" />
    </IcoMulti>
);
const IcoReports = ({ size = 16, color = 'currentColor' }) => (
    <IcoMulti size={size}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IcoMulti>
);
const IcoMonthly = ({ size = 16, color = 'currentColor' }) => (
    <IcoMulti size={size}>
        <rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="1.8" />
        <path d="M16 2v4M8 2v4M3 10h18M8 14h4M8 18h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </IcoMulti>
);
const IcoAdmins = ({ size = 16, color = 'currentColor' }) => (
    <IcoMulti size={size}>
        <circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.8" />
        <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M19 8v6M22 11h-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </IcoMulti>
);
const IcoLogout = ({ size = 16, color = 'currentColor' }) => (
    <IcoMulti size={size}>
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IcoMulti>
);
const IcoChevron = ({ size = 12, color = 'currentColor' }) => (
    <Ico d="M9 18l6-6-6-6" size={size} color={color} />
);

const NAV = [
    { label: 'Dashboard', path: '/dashboard', icon: IcoDashboard, superOnly: false, section: 'Menu' },
    { label: 'Profiles', path: '/reports', icon: IcoReports, superOnly: false, section: 'Menu' },
    { label: 'Monthly Report', path: '/monthly-report', icon: IcoMonthly, superOnly: true, section: 'Management' },
    { label: 'Admin Management', path: '/admin-management', icon: IcoAdmins, superOnly: true, section: 'Management' },
];

// Group the visible nav items into their sections, preserving order.
const groupNav = (isSuper) => {
    const out = [];
    NAV.filter(n => isSuper || !n.superOnly).forEach(it => {
        let g = out.find(x => x.name === it.section);
        if (!g) { g = { name: it.section, items: [] }; out.push(g); }
        g.items.push(it);
    });
    return out;
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const admin = getAdmin();
    const role = admin.position || '';
    const isSuper = !!admin.is_super_admin;
    const [unread, setUnread] = useState(0);
    const [burstAlert, setBurstAlert] = useState(null); // { active, newest_at, ... } | null

    useEffect(() => {
        const fetch = () => {
            api.get('/admin/cases/unread-count')
                .then(r => {
                    setUnread(r.data.unread || 0);
                    setBurstAlert(r.data.multi_alert || null);
                })
                .catch(() => { });
        };
        fetch();
        const t = setInterval(fetch, 30000); // poll every 30s for snappier burst detection
        return () => clearInterval(t);
    }, []);

    // Burst alert visible only if active AND not dismissed for this newest_at timestamp
    const burstDismissedAt = (typeof window !== 'undefined') ? localStorage.getItem('multi_alert_dismissed_at') : null;
    const showBurstAlert = !!(burstAlert && burstAlert.active && burstAlert.newest_at && burstAlert.newest_at !== burstDismissedAt);

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        localStorage.removeItem('face_verified');
        navigate('/');
    };

    const initials = [admin.first_name, admin.last_name]
        .filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?';

    return (
        <aside style={S.sidebar}>
            {/* Rose accent stripe at top */}
            <div style={S.topAccent} />

            {/* Logo / Branding */}
            <div style={S.logoArea}>
                <div style={S.logoIconWrap}>
                    <img src="/barangay-logo.png" alt="Barangay Palanginan Seal"
                         style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', imageRendering: '-webkit-optimize-contrast' }}
                         onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
                <div>
                    <div style={S.logoTitle}>VAWC-Response</div>
                    <div style={S.logoSub}>Barangay Palanginan · Iba, Zambales</div>
                </div>
            </div>

            <div style={S.divider} />

            {/* Admin card */}
            <div style={S.adminCard}>
                <div style={isSuper ? S.avatarSuper : S.avatar}>{initials}</div>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div style={S.adminName}>{admin.first_name} {admin.last_name}</div>
                    <div style={isSuper ? S.rolePillSuper : S.rolePill}>
                        {isSuper && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                        {role}
                    </div>
                </div>
            </div>

            <div style={S.divider} />

            {/* Nav */}
            <nav style={S.nav}>
                {groupNav(isSuper).map(group => (
                    <div key={group.name} style={S.navGroup}>
                        <p style={S.navSection}>{group.name}</p>
                        {group.items.map(item => {
                            const active = location.pathname === item.path;
                            const NavIcon = item.icon;
                            // New-reports indicator lives on Dashboard (where reports are reviewed).
                            const showDashDot = item.path === '/dashboard' && unread > 0;
                            return (
                                <button
                                    key={item.path}
                                    className={`vawc-nav-btn${active ? ' active' : ''}`}
                                    onClick={() => navigate(item.path)}
                                    title={showDashDot ? 'Please check new reports' : undefined}
                                    style={{ ...S.navBtn, ...(active ? S.navBtnActive : {}) }}
                                >
                                    {active && <div style={S.navActiveBar} />}
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <NavIcon size={18} color={active ? '#FFFFFF' : '#E1BEE7'} />
                                        {showDashDot && (
                                            <span className="burst-dot" title="Please check new reports"
                                                style={{ position: 'absolute', top: -4, right: -5, minWidth: 9, height: 9, borderRadius: '50%', background: '#EF4444', border: '2px solid #4A1259' }} />
                                        )}
                                    </div>
                                    <span style={{ ...S.navLabel, color: active ? '#FFFFFF' : '#E1BEE7', fontWeight: active ? 700 : 500 }}>
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Logout */}
            <div style={{ padding: '12px', borderTop: '1px solid #5C1F6E', marginTop: 'auto' }}>
                <button className="vawc-logout" onClick={handleLogout} style={S.logoutBtn}>
                    <IcoLogout size={16} color="#FFCC99" />
                    <span style={S.logoutLabel}>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────
// `breadcrumbs` is the trail AFTER the "Dashboard" home crumb. Each item is a
// string, or { label, onClick } to make it a clickable step. When a page does
// not supply it, the trail falls back to the section name derived from the URL.
function TopBar({ breadcrumbs }) {
    const admin = getAdmin();
    const location = useLocation();
    const navigate = useNavigate();
    const initials = [admin.first_name, admin.last_name]
        .filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?';

    const titles = {
        '/dashboard': 'Dashboard',
        '/reports': 'Profiles',
        '/admin-management': 'Admin Management',
    };
    const pathBase = '/' + location.pathname.split('/')[1];
    const pageTitle = titles[pathBase] || 'VAWC-Response';
    const isDashboard = pathBase === '/dashboard';

    // Home crumb is always "Dashboard"; the rest is the page-supplied trail
    // (or the section name as a URL fallback). Dashboard itself has no trail.
    const trail = breadcrumbs != null ? breadcrumbs : (isDashboard ? [] : [pageTitle]);
    const crumbs = [
        { label: 'Dashboard', onClick: () => navigate('/dashboard') },
        ...trail.map(c => (typeof c === 'string' ? { label: c } : c)),
    ];

    return (
        <header style={S.topBar}>
            <div>
                <h1 style={S.pageTitle}>{pageTitle}</h1>
                <div style={S.breadcrumb}>
                    {crumbs.map((c, i) => {
                        const last = i === crumbs.length - 1;
                        const clickable = !last && typeof c.onClick === 'function';
                        return (
                            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {i > 0 && <IcoChevron size={11} color="#CBD5E1" />}
                                <span
                                    onClick={clickable ? c.onClick : undefined}
                                    title={clickable ? `Go to ${c.label}` : undefined}
                                    style={{ ...S.breadCrumb, color: last ? COLORS.primary : '#94A3B8', fontWeight: last ? 600 : 400, cursor: clickable ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
                                    {c.label}
                                </span>
                            </span>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ThemeToggle size={36} />
                <div style={S.topDate}>
                    {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
                <div style={{ width: 1, height: 28, backgroundColor: COLORS.border }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={S.topAvatar}>{initials}</div>
                    <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, fontFamily: TEXT.font }}>
                            {admin.first_name} {admin.last_name}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: COLORS.textMuted, fontFamily: TEXT.font }}>
                            {admin.position || 'Admin'}
                        </p>
                    </div>
                </div>
            </div>
        </header>
    );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export function AdminLayout({ children, breadcrumbs }) {
    const location = useLocation();
    return (
        <div style={S.layout}>
            <Sidebar />
            <div style={S.content}>
                <TopBar breadcrumbs={breadcrumbs} />
                <main style={S.main}>
                    {/* keyed by route so the content re-animates on each page change */}
                    <div key={location.pathname} className="page-enter">{children}</div>
                </main>
            </div>
            <ConfirmHost />
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
    layout: { display: 'flex', minHeight: '100vh', backgroundColor: COLORS.bgPage, fontFamily: TEXT.font },

    // Sidebar — brand violet
    sidebar: { width: 252, flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', backgroundColor: '#4A1259', display: 'flex', flexDirection: 'column', zIndex: 100, overflowY: 'auto', borderRight: '1px solid #5C1F6E' },
    topAccent: { height: 3, backgroundColor: COLORS.primary, flexShrink: 0 },

    logoArea: { display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 18px' },
    logoIconWrap: { width: 64, height: 64, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', padding: 0, boxSizing: 'border-box', background: '#fff', border: '2px solid #FFCC99' },
    logoTitle: { fontSize: 14, fontWeight: 700, color: '#FFFFFF', fontFamily: NAVFONT, letterSpacing: '0.3px' },
    logoSub: { fontSize: 9.5, color: '#E1BEE7', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: 2, fontFamily: TEXT.font },

    divider: { height: 1, backgroundColor: '#5C1F6E', margin: '0 16px' },

    adminCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px' },
    avatar: { width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: TEXT.font },
    avatarSuper: { width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.secondaryDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: TEXT.font, boxShadow: '0 0 0 2px rgba(244,121,32,0.25)' },
    adminName: { fontSize: 13, fontWeight: 600, color: '#E2E8F0', fontFamily: TEXT.font, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    rolePill: { display: 'inline-flex', alignItems: 'center', marginTop: 3, fontSize: 10, fontWeight: 700, color: '#E1BEE7', backgroundColor: 'rgba(123,45,139,0.12)', padding: '2px 8px', borderRadius: 9999, fontFamily: TEXT.font, letterSpacing: '0.3px' },
    rolePillSuper: { display: 'inline-flex', alignItems: 'center', marginTop: 3, fontSize: 10, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.secondaryDark})`, padding: '3px 9px', borderRadius: 9999, fontFamily: TEXT.font, letterSpacing: '0.4px', textTransform: 'uppercase', boxShadow: '0 1px 3px rgba(196,94,16,0.3)' },

    nav: { flex: 1, padding: '10px 12px 0' },
    navGroup: { marginBottom: 14 },
    navSection: { fontSize: 10, fontWeight: 600, color: '#C4A6D1', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '4px 12px 8px', margin: 0, fontFamily: NAVFONT },
    navBtn: { position: 'relative', display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', marginBottom: 3, textAlign: 'left' },
    navBtnActive: { backgroundColor: 'rgba(244,121,32,0.18)' },
    navActiveBar: { position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, borderRadius: '0 3px 3px 0', backgroundColor: COLORS.primary },
    navLabel: { fontSize: 14, fontFamily: NAVFONT, letterSpacing: '0.2px' },
    badge: { marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9, background: COLORS.primary, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', fontFamily: TEXT.font },

    logoutBtn: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' },
    logoutLabel: { fontSize: 13.5, fontWeight: 600, color: '#FFCC99', fontFamily: TEXT.font },

    // Top bar
    topBar: { height: 62, backgroundColor: COLORS.bgCard, borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', position: 'sticky', top: 0, zIndex: 50, boxShadow: 'var(--adm-card-shadow)' },
    pageTitle: { margin: 0, fontSize: 17, fontWeight: 700, color: COLORS.textPrimary, fontFamily: TEXT.font, letterSpacing: '-0.2px' },
    breadcrumb: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 },
    breadCrumb: { fontSize: 11.5, color: '#94A3B8', fontFamily: TEXT.font },
    topDate: { fontSize: 12, color: COLORS.textMuted, fontFamily: TEXT.font },
    topAvatar: { width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: TEXT.font, flexShrink: 0 },

    // Content
    content: { marginLeft: 252, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' },
    main: { flex: 1, padding: '28px 32px', maxWidth: 1400, width: '100%', marginLeft: 'auto', marginRight: 'auto', boxSizing: 'border-box' },
};

export default Sidebar;
