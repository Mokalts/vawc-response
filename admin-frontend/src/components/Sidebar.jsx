import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/api';
import { COLORS, TEXT, GLOBAL_CSS } from '../theme';

// ─── Inject global styles once ────────────────────────────────────────────────
if (!document.getElementById('vawc-global-css')) {
    const s = document.createElement('style');
    s.id = 'vawc-global-css';
    s.textContent = GLOBAL_CSS + `
        .vawc-nav-btn { transition: background 0.15s ease, transform 0.15s ease; }
        .vawc-nav-btn:hover:not(.active) { background: rgba(255,255,255,0.05) !important; }
        .vawc-nav-btn.active { background: rgba(244,121,32,0.18) !important; }
        .vawc-logout:hover { background: rgba(123,45,139,0.08) !important; }
        .vawc-logout { transition: background 0.15s ease; }
        @keyframes burstPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(244,121,32,0.65); }
            50%      { box-shadow: 0 0 0 6px rgba(244,121,32,0); }
        }
        .burst-dot { animation: burstPulse 1.4s infinite; }
    `;
    document.head.appendChild(s);
}

const getAdmin = () => {
    try { return JSON.parse(localStorage.getItem('admin_user')) || {}; }
    catch { return {}; }
};

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
    { label: 'Dashboard', path: '/dashboard', icon: IcoDashboard, superOnly: false },
    { label: 'Profiles', path: '/reports', icon: IcoReports, superOnly: false },
    { label: 'Admin Management', path: '/admin-management', icon: IcoAdmins, superOnly: true },
];

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
                <p style={S.navSection}>Control Panel</p>
                {NAV.filter(n => isSuper || !n.superOnly).map(item => {
                    const active = location.pathname === item.path;
                    const NavIcon = item.icon;
                    const showBadge = item.path === '/reports' && unread > 0;
                    const showBurstDot = item.path === '/dashboard' && showBurstAlert;
                    return (
                        <button
                            key={item.path}
                            className={`vawc-nav-btn${active ? ' active' : ''}`}
                            onClick={() => navigate(item.path)}
                            style={{ ...S.navBtn, ...(active ? S.navBtnActive : {}) }}
                        >
                            {/* Active left bar */}
                            {active && <div style={S.navActiveBar} />}

                            <div style={{ ...S.navIconWrap, ...(active ? S.navIconActive : {}), position: 'relative' }}>
                                <NavIcon size={16} color={active ? '#fff' : '#E1BEE7'} />
                                {showBurstDot && (
                                    <span className="burst-dot" style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: '#F47920', border: '2px solid #4A1259' }} />
                                )}
                            </div>

                            <span style={{ ...S.navLabel, color: active ? '#FFFFFF' : '#E1BEE7', fontWeight: active ? 700 : 500 }}>
                                {item.label}
                            </span>

                            {showBadge && (
                                <span style={S.badge}>
                                    {unread > 99 ? '99+' : unread}
                                </span>
                            )}
                        </button>
                    );
                })}
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
function TopBar() {
    const admin = getAdmin();
    const location = useLocation();
    const initials = [admin.first_name, admin.last_name]
        .filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?';

    // Derive page title from path
    const titles = {
        '/dashboard': 'Dashboard',
        '/reports': 'Cases',
        '/admin-management': 'Admin Management',
    };
    const pathBase = '/' + location.pathname.split('/')[1];
    const pageTitle = titles[pathBase] || 'VAWC-Response';

    // Breadcrumbs
    const parts = location.pathname.split('/').filter(Boolean);

    return (
        <header style={S.topBar}>
            <div>
                <h1 style={S.pageTitle}>{pageTitle}</h1>
                <div style={S.breadcrumb}>
                    <span style={S.breadCrumb}>Home</span>
                    {parts.map((p, i) => (
                        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <IcoChevron size={11} color="#CBD5E1" />
                            <span style={{ ...S.breadCrumb, color: i === parts.length - 1 ? COLORS.primary : '#94A3B8', fontWeight: i === parts.length - 1 ? 600 : 400 }}>
                                {p.charAt(0).toUpperCase() + p.slice(1).replace(/-/g, ' ')}
                            </span>
                        </span>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
export function AdminLayout({ children }) {
    return (
        <div style={S.layout}>
            <Sidebar />
            <div style={S.content}>
                <TopBar />
                <main style={S.main}>{children}</main>
            </div>
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
    layout: { display: 'flex', minHeight: '100vh', backgroundColor: COLORS.bgPage, fontFamily: TEXT.font },

    // Sidebar
    sidebar: { width: 252, flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', backgroundColor: '#4A1259', display: 'flex', flexDirection: 'column', zIndex: 100, overflowY: 'auto', borderRight: '1px solid #5C1F6E' },
    topAccent: { height: 3, backgroundColor: COLORS.primary, flexShrink: 0 },

    logoArea: { display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 18px' },
    logoIconWrap: { width: 56, height: 56, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', padding: 0, boxSizing: 'border-box', background: 'transparent', border: 'none' },
    logoTitle: { fontSize: 13.5, fontWeight: 700, color: '#FFFFFF', fontFamily: TEXT.font, letterSpacing: '0.2px' },
    logoSub: { fontSize: 9.5, color: '#E1BEE7', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: 2, fontFamily: TEXT.font },

    divider: { height: 1, backgroundColor: '#5C1F6E', margin: '0 16px' },

    adminCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px' },
    avatar: { width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: TEXT.font },
    avatarSuper: { width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.secondaryDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: TEXT.font, boxShadow: '0 0 0 2px rgba(244,121,32,0.25)' },
    adminName: { fontSize: 13, fontWeight: 600, color: '#E2E8F0', fontFamily: TEXT.font, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    rolePill: { display: 'inline-flex', alignItems: 'center', marginTop: 3, fontSize: 10, fontWeight: 700, color: COLORS.primaryLight, backgroundColor: 'rgba(123,45,139,0.12)', padding: '2px 8px', borderRadius: 9999, fontFamily: TEXT.font, letterSpacing: '0.3px' },
    rolePillSuper: { display: 'inline-flex', alignItems: 'center', marginTop: 3, fontSize: 10, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.secondaryDark})`, padding: '3px 9px', borderRadius: 9999, fontFamily: TEXT.font, letterSpacing: '0.4px', textTransform: 'uppercase', boxShadow: '0 1px 3px rgba(196,94,16,0.3)' },

    nav: { flex: 1, padding: '12px 10px 0' },
    navSection: { fontSize: 10, fontWeight: 700, color: '#C4A6D1', letterSpacing: '1.2px', textTransform: 'uppercase', padding: '6px 10px 10px', fontFamily: TEXT.font },
    navBtn: { position: 'relative', display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', marginBottom: 2 },
    navBtnActive: { backgroundColor: 'rgba(244,121,32,0.18)' },
    navActiveBar: { position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, borderRadius: 2, backgroundColor: COLORS.secondary },
    navIconWrap: { width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#5C1F6E', flexShrink: 0 },
    navIconActive: { backgroundColor: COLORS.secondary },
    navLabel: { fontSize: 13.5, fontFamily: TEXT.font },
    badge: { marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9, background: COLORS.secondary, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', fontFamily: TEXT.font },

    logoutBtn: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' },
    logoutLabel: { fontSize: 13.5, fontWeight: 600, color: '#FFCC99', fontFamily: TEXT.font },

    // Top bar
    topBar: { height: 62, backgroundColor: COLORS.white, borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' },
    pageTitle: { margin: 0, fontSize: 17, fontWeight: 700, color: COLORS.textPrimary, fontFamily: TEXT.font, letterSpacing: '-0.2px' },
    breadcrumb: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 },
    breadCrumb: { fontSize: 11.5, color: '#94A3B8', fontFamily: TEXT.font },
    topDate: { fontSize: 12, color: COLORS.textMuted, fontFamily: TEXT.font },
    topAvatar: { width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: TEXT.font, flexShrink: 0 },

    // Content
    content: { marginLeft: 252, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' },
    main: { flex: 1, padding: '28px 32px', maxWidth: 1400 },
};

export default Sidebar;
