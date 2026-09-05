import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

if (!document.getElementById('vawc-sidebar-menu-css')) {
    const s = document.createElement('style'); s.id = 'vawc-sidebar-menu-css';
    s.textContent = `
        @keyframes slideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        .vsm-item { transition: background-color 0.12s ease, transform 0.12s ease; }
        .vsm-item:hover { background-color: var(--surface-tint) !important; }
        .vsm-item:active { background-color: var(--surface-tint) !important; transform: scale(0.99); }
        .vsm-logout:hover { filter: brightness(0.95); }
    `;
    document.head.appendChild(s);
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IcoUser     = ({ c='#F47920' }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoSettings = ({ c='#F47920' }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.8"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={c} strokeWidth="1.8"/></svg>);
const IcoPhone    = ({ c='#F47920' }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoLogout   = ({ c='#F47920' }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 17l5-5-5-5M21 12H9" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoChevron  = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoGuide    = ({ c='#F47920' }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 6.5A5.5 5.5 0 008 5H3v13h5a4 4 0 014 2 4 4 0 014-2h5V5h-5a5.5 5.5 0 00-4 1.5z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 6.5V20" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoX        = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round"/></svg>);

function SidebarMenu({ isOpen, onClose }) {
    const navigate  = useNavigate();
    const location  = useLocation();

    // Read user from localStorage
    const user = (() => { try { return JSON.parse(localStorage.getItem('user')||'{}'); } catch { return {}; } })();
    const initials = [user.first_name, user.last_name].filter(Boolean).map(n=>n[0]).join('').toUpperCase() || '?';
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'My Account';

    // Esc closes the drawer.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    const go = (path) => { onClose(); navigate(path); };
    const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); onClose(); navigate('/'); };

    // Replay the first-time walkthrough on the Home page.
    const replayTour = () => {
        localStorage.removeItem('vawc_home_tour_v1');
        onClose();
        navigate('/home');
        setTimeout(() => window.dispatchEvent(new Event('vawc:start-tour')), 200);
    };

    const navItems = [
        { label:'My Profile',      path:'/profile',  icon:<IcoUser /> },
        { label:'Paano Gamitin',   action: replayTour, icon:<IcoGuide /> },
        { label:'Settings',        path:'/settings', icon:<IcoSettings /> },
        { label:'Contact Us',      path:'/contact',  icon:<IcoPhone /> },
    ];

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div style={S.backdrop} onClick={onClose} />
            )}

            {/* Drawer */}
            <div style={{ ...S.drawer, transform: isOpen?'translateX(0)':'translateX(100%)', animation: isOpen?'slideIn 0.25s ease':'none' }}
                role="dialog" aria-modal="true" aria-label="Menu">

                {/* Header */}
                <div style={S.header}>
                    <div style={S.avatarWrap}>
                        <div style={S.avatar}>{initials}</div>
                        <div>
                            <p style={S.name}>{fullName}</p>
                            <p style={S.sub}>VAWC-Response</p>
                        </div>
                    </div>
                    <button style={S.closeBtn} onClick={onClose} aria-label="Isara ang menu"><IcoX /></button>
                </div>

                <div style={S.divider} />

                {/* Nav */}
                <nav style={S.nav}>
                    {navItems.map(item => {
                        const active = item.path && location.pathname === item.path;
                        return (
                            <button key={item.path || item.label} className="vsm-item"
                                onClick={() => (item.action ? item.action() : go(item.path))}
                                style={{ ...S.navItem, backgroundColor: active ? 'var(--surface-tint)' : 'transparent' }}>
                                <div style={{ ...S.navIcon, backgroundColor: active ? 'var(--surface-tint)' : 'var(--surface-alt)' }}>
                                    {React.cloneElement(item.icon, { c: active ? '#C45E10' : '#F47920' })}
                                </div>
                                <span style={{ ...S.navLabel, color: active ? 'var(--accent-text)' : 'var(--text)', fontWeight: active ? 700 : 600 }}>
                                    {item.label}
                                </span>
                                <IcoChevron />
                            </button>
                        );
                    })}
                </nav>

                <div style={S.divider} />

                {/* Logout */}
                <button className="vsm-logout" style={S.logoutBtn} onClick={handleLogout}>
                    <IcoLogout />
                    <span style={{ fontSize:14.5, fontWeight:600, color:'var(--accent-text)', fontFamily:"'Lexend', sans-serif" }}>Sign Out</span>
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '0 20px 24px' }}>
                    <img src="/barangay-logo.png" alt="Barangay Palanginan Seal"
                         style={{ width: 42, height: 42, objectFit: 'contain', opacity: 0.95 }}
                         onError={(e) => { e.target.style.display = 'none'; }} />
                    <p style={{ ...S.footerNote, padding: 0 }}>Barangay Palanginan, Iba, Zambales</p>
                </div>
            </div>
        </>
    );
}

const S = {
    backdrop:  { position:'fixed', inset:0, backgroundColor:'var(--overlay)', zIndex:290, backdropFilter:'blur(2px)', animation:'fadeIn 0.2s ease' },
    drawer:    { position:'fixed', top:0, right:0, width:288, height:'100vh', backgroundColor:'var(--surface)', boxShadow:'-8px 0 32px rgba(15,23,42,0.18)', zIndex:300, display:'flex', flexDirection:'column', transition:'transform 0.25s ease', fontFamily:"'Lexend', sans-serif", borderLeft:'1px solid var(--border)' },
    header:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 20px 20px' },
    avatarWrap:{ display:'flex', alignItems:'center', gap:12 },
    avatar:    { width:44, height:44, borderRadius: '50%', background:'linear-gradient(135deg,#FFE4CC,#F47920)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'#fff', flexShrink:0, fontFamily:"'Lexend', sans-serif" },
    name:      { fontSize:15, fontWeight:700, color:'var(--text)', margin:'0 0 2px', fontFamily:"'Lexend', sans-serif" },
    sub:       { fontSize:12, color:'var(--text-muted)', margin:0, fontFamily:"'Lexend', sans-serif" },
    closeBtn:  { width:44, height:44, borderRadius: 10, backgroundColor:'var(--surface-alt)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 },
    divider:   { height:1, backgroundColor:'var(--border-soft)', margin:'0 20px' },
    nav:       { display:'flex', flexDirection:'column', padding:'12px 12px', flex:1 },
    navItem:   { display:'flex', alignItems:'center', gap:12, padding:'11px 12px', borderRadius: 10, border:'none', cursor:'pointer', width:'100%', textAlign:'left', transition:'background-color 0.12s' },
    navIcon:   { width:36, height:36, borderRadius: 10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background-color 0.12s' },
    navLabel:  { flex:1, fontSize:14.5, fontFamily:"'Lexend', sans-serif" },
    logoutBtn: { display:'flex', alignItems:'center', gap:12, padding:'16px 20px', background:'none', border:'none', cursor:'pointer', width:'100%', transition:'color 0.12s' },
    footerNote:{ textAlign:'center', fontSize:11, color:'#78716C', padding:'0 20px 24px', fontFamily:"'Lexend', sans-serif" },
};

export default SidebarMenu;
