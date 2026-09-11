import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

if (!document.getElementById('vawc-nav-css')) {
    const s = document.createElement('style'); s.id = 'vawc-nav-css';
    s.textContent = `
        @keyframes navPop { 0%{transform:scale(1)} 50%{transform:scale(0.88)} 100%{transform:scale(1)} }
        .vn-btn { display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:4px; background:none; border:none; cursor:pointer; flex:1; height:100%; padding:0 0 9px; border-radius: 12px; transition:background-color 0.15s; -webkit-tap-highlight-color:transparent; font-family:'Lexend',sans-serif; }
        .vn-btn:active, .vn-btn.pressed { animation:navPop 0.15s ease; background-color:rgba(244,121,32,0.08); }
        .vn-label { font-size:11px; font-weight:600; transition:color 0.15s; font-family:'Lexend',sans-serif; line-height:1; }
        .vn-center { display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:4px; background:none; border:none; cursor:pointer; flex:1.4; height:100%; padding:0 0 9px; border-radius: 12px; -webkit-tap-highlight-color:transparent; transition:background-color 0.15s; }
        .vn-center:active, .vn-center.pressed { animation:navPop 0.15s ease; background-color:rgba(244,121,32,0.08); }
    `;
    document.head.appendChild(s);
}

const IcoHome = ({ color }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 9.5L12 3L21 9.5V20C21 20.5523 20.5523 21 20 21H15V15H9V21H4C3.44772 21 3 20.5523 3 20V9.5Z"
            stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
);
const IcoPlus = ({ color }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 5V19M5 12H19" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
);
const IcoDoc  = ({ color }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M6 2H14L20 8V22H6V2Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M14 2V8H20" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 13H15M9 17H13" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
);

function BottomNavbar({ active }) {
    const navigate = useNavigate();
    const [pressed, setPressed] = useState(null);

    const go = (key, path) => {
        setPressed(key);
        setTimeout(() => { setPressed(null); navigate(path); }, 150);
    };

    // Active = orange; inactive = theme-aware muted (AA in both light and dark)
    const color = (key) => active === key ? '#F47920' : 'var(--text-muted)';

    return (
        <nav style={S.nav} aria-label="Pangunahing nabigasyon">
            {/* Home */}
            <button className={`vn-btn${pressed==='home'?' pressed':''}`} onClick={() => go('home', '/home')}
                aria-label="Home" aria-current={active === 'home' ? 'page' : undefined}>
                <IcoHome color={color('home')} />
                <span className="vn-label" style={{ color: color('home') }}>Home</span>
            </button>

            {/* Report Now - center featured button (orange = primary report CTA) */}
            <button className={`vn-center${pressed==='report'?' pressed':''}`} onClick={() => go('report', '/report')}
                aria-label="Report Now, magsumite ng report" aria-current={active === 'report' ? 'page' : undefined}>
                <div style={{
                    ...S.reportCircle,
                    backgroundColor: active === 'report' ? '#F47920' : 'var(--surface)',
                    border: `2px solid ${active === 'report' ? '#F47920' : '#FFCC99'}`,
                    boxShadow: active === 'report' ? '0 4px 12px rgba(196,94,16,0.35)' : '0 2px 8px rgba(196,94,16,0.15)',
                }}>
                    <IcoPlus color={active === 'report' ? '#fff' : '#F47920'} />
                </div>
                <span className="vn-label" style={{ color: active === 'report' ? '#F47920' : 'var(--text-muted)' }}>Report Now</span>
            </button>

            {/* My Reports */}
            <button data-tour="myreports" className={`vn-btn${pressed==='reports'?' pressed':''}`} onClick={() => go('reports', '/my-reports')}
                aria-label="My Reports, subaybayan ang iyong kaso" aria-current={active === 'reports' ? 'page' : undefined}>
                <IcoDoc color={color('reports')} />
                <span className="vn-label" style={{ color: color('reports') }}>My Reports</span>
            </button>
        </nav>
    );
}

const S = {
    nav: {
        // Centred and capped to the content width so on a wide screen the bar
        // lines up with the cards above it instead of stretching edge to edge.
        // Page content is max-width 1060 with 18px padding, so its cards span
        // 1024; the bar matches that. Below 1060 it keeps the old 12px insets.
        position: 'fixed', bottom: 10, left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)', maxWidth: 1024, height: 62,
        backgroundColor: 'var(--nav)', border: '1px solid var(--border)', borderRadius: 20,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'stretch',
        padding: '0 8px', zIndex: 200,
        boxShadow: '0 8px 24px rgba(40,20,10,0.14)',
    },
    reportCircle: {
        width: 46, height: 46, borderRadius: '50%', marginTop: -16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease',
    },
};

export default BottomNavbar;
