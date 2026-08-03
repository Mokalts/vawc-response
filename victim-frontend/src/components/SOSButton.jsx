import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

// ─── Font + scoped CSS ──────────────────────────────────────────────────────
if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-sos-css')) {
    const s = document.createElement('style'); s.id = 'vawc-sos-css';
    s.textContent = `
        @keyframes sosPulse {
            0%   { box-shadow: 0 0 0 0 rgba(196,94,16,0.45), 0 6px 18px rgba(220,38,38,0.30); }
            70%  { box-shadow: 0 0 0 14px rgba(196,94,16,0),  0 6px 18px rgba(220,38,38,0.30); }
            100% { box-shadow: 0 0 0 0 rgba(196,94,16,0),     0 6px 18px rgba(220,38,38,0.30); }
        }
        @keyframes sosFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes sosSlideUp { from{opacity:0; transform:translateY(20px)} to{opacity:1; transform:translateY(0)} }
        .sos-btn { animation: sosPulse 1.8s infinite; transition: transform 0.15s ease, filter 0.15s ease; }
        .sos-btn:hover  { transform: translateY(-1px); filter: brightness(1.06); }
        .sos-btn:active { transform: scale(0.97); }
        .sos-card { transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }
        .sos-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(244,121,32,0.18); border-color: #FFCC99; }
        .sos-card:active { transform: scale(0.98); }
        .sos-call:hover { background: #C2410C !important; }
        .sos-overlay { animation: sosFadeIn 0.18s ease; }
        .sos-modal   { animation: sosSlideUp 0.22s ease; }
        .sos-close:hover { background: #FFF3E0 !important; }
    `;
    document.head.appendChild(s);
}

// ─── Hotlines + nearest station (edit values for production) ────────────────
const HOTLINES = [
    { label: 'PNP Hotline - Iba, Zambales',      dial: '911',           display: '911',            desc: 'Police emergency response (Iba, Zambales & nationwide)', priority: true },
    { label: 'VAWC Desk - Barangay Palanginan',  dial: '+639286673772', display: '0928 667 3772',  desc: 'Ms. Maria Theresa M. De Leon - Admin Assistant, Sanitation & Welfare Service (VAWC)', priority: true },
    { label: 'DSWD Hotline',                     dial: '1343',          display: '1343',           desc: '24/7 violence & trafficking hotline' },
    { label: 'Test Number (Semaphore)',          dial: '+639085267335', display: '0908 526 7335',  desc: 'For system testing purposes only - not an official hotline.', test: true },
];

const NEAREST_STATION = {
    name:     'Iba Police Station',
    address:  'Bonifacio St, Iba, Zambales',
    distance: 'Approx. 2 km from Brgy. Palanginan',
};

// ─── Icons ──────────────────────────────────────────────────────────────────
const IcoSOS = ({ size = 22 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 8v5M12 16h.01" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
);
const IcoX     = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="#F47920" strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoPhone = ({ c = '#fff' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoPin   = ({ c = '#F47920' }) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="10" r="3" stroke={c} strokeWidth="2" /></svg>);

// ─── Component ──────────────────────────────────────────────────────────────
function SOSButton({ variant = 'block' }) {
    const [open, setOpen] = useState(false);

    // Lock body scroll while modal open + ESC to close
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = e => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const btnStyle = variant === 'compact' ? S.compactBtn : S.blockBtn;
    const btnText  = variant === 'compact' ? 'Emergency SOS' : 'Emergency SOS - Tap to Call';

    return (
        <>
            <button
                type="button"
                className="sos-btn"
                style={btnStyle}
                onClick={() => setOpen(true)}
                aria-label="Open emergency hotlines"
            >
                <IcoSOS size={variant === 'compact' ? 18 : 22} />
                <span>{btnText}</span>
            </button>

            {open && ReactDOM.createPortal(
                <div className="sos-overlay" style={S.overlay} onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-labelledby="sos-title">
                    <div className="sos-modal" style={S.modal} onClick={e => e.stopPropagation()}>

                        <div style={S.modalHeader}>
                            <div>
                                <p id="sos-title" style={S.modalTitle}>Emergency Hotlines</p>
                                <p style={S.modalSub}>Tap any number to call immediately</p>
                            </div>
                            <button type="button" className="sos-close" style={S.closeBtn} onClick={() => setOpen(false)} aria-label="Close">
                                <IcoX />
                            </button>
                        </div>

                        <div style={S.list}>
                            {HOTLINES.map(h => (
                                <a
                                    key={h.dial}
                                    href={`tel:${h.dial}`}
                                    className="sos-card"
                                    style={{ ...S.card, ...(h.priority ? S.cardPriority : {}) }}
                                >
                                    <div style={S.cardLeft}>
                                        <div style={{ ...S.cardIcon, background: '#FFF3E0' }}>
                                            <IcoPhone c="#C45E10" />
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <p style={S.cardLabel}>{h.label}</p>
                                            <p style={{ ...S.cardDesc, ...(h.test ? { color: '#C45E10', fontStyle: 'italic', fontWeight: 600 } : {}) }}>{h.desc}</p>
                                        </div>
                                    </div>
                                    <span className="sos-call" style={S.callBtn}>
                                        <IcoPhone />
                                        {h.display}
                                    </span>
                                </a>
                            ))}
                        </div>

                        <div style={S.station}>
                            <div style={S.stationHead}>
                                <IcoPin />
                                <p style={S.stationTitle}>Nearest Police Station</p>
                            </div>
                            <p style={S.stationName}>{NEAREST_STATION.name}</p>
                            <p style={S.stationAddr}>{NEAREST_STATION.address}</p>
                            <p style={S.stationDist}>{NEAREST_STATION.distance}</p>
                        </div>

                        <p style={S.footnote}>
                            If you are in immediate danger, call <strong style={{ color: '#DC2626' }}>911</strong> first. Stay on the line until help arrives.
                        </p>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

const S = {
    // ── SOS button variants
    blockBtn: {
        width: '100%', padding: '16px 18px',
        background: 'linear-gradient(135deg, #F47920 0%, #DC2626 100%)',
        color: '#fff', fontSize: 15.5, fontWeight: 800,
        border: 'none', borderRadius: 16, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase',
        boxShadow: '0 8px 22px rgba(220,38,38,0.28)',
    },
    compactBtn: {
        padding: '11px 18px',
        background: 'linear-gradient(135deg, #F47920 0%, #DC2626 100%)',
        color: '#fff', fontSize: 13, fontWeight: 700,
        border: 'none', borderRadius: 9999, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.03em', textTransform: 'uppercase',
        boxShadow: '0 6px 16px rgba(220,38,38,0.22)',
    },

    // ── Modal
    overlay: {
        position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 14px', backdropFilter: 'blur(4px)',
    },
    modal: {
        background: '#fff', borderRadius: 24,
        width: '100%', maxWidth: 460, maxHeight: '88vh', overflowY: 'auto',
        padding: '24px 20px 22px',
        boxShadow: '0 -12px 44px rgba(244,121,32,0.22)',
        border: '1px solid #FFE4CC',
    },
    modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
    modalTitle:  { margin: 0, fontSize: 19, fontWeight: 800, color: '#C45E10', fontFamily: "'DM Sans', sans-serif" },
    modalSub:    { margin: '3px 0 0', fontSize: 12.5, color: '#F47920', fontFamily: "'DM Sans', sans-serif" },
    closeBtn:    { width: 34, height: 34, borderRadius: 10, background: '#FFF3E0', border: '1px solid #FFE4CC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },

    // ── Hotline cards
    list: { display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 },
    card: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: '12px 13px', background: '#fff',
        border: '1.5px solid #FFE9D6', borderRadius: 16,
        textDecoration: 'none', cursor: 'pointer',
    },
    cardPriority: { background: '#FFF3E0', borderColor: '#FFCC99', boxShadow: '0 4px 14px rgba(196,94,16,0.1)' },
    cardLeft:     { display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 },
    cardIcon:     { width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    cardLabel:    { margin: 0, fontSize: 13.5, fontWeight: 700, color: '#1E1B4B', lineHeight: 1.25, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    cardDesc:     { margin: '2px 0 0', fontSize: 11.5, color: '#64748B', lineHeight: 1.35, fontFamily: "'DM Sans', sans-serif" },
    callBtn:      {
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 11px', background: '#C45E10', color: '#fff',
        borderRadius: 8, fontSize: 12, fontWeight: 700,
        whiteSpace: 'nowrap', flexShrink: 0,
        fontFamily: "'DM Sans', sans-serif",
        transition: 'background 0.15s ease',
    },

    // ── Nearest station
    station:      { background: '#FFF3E0', border: '1.5px solid #FFE4CC', borderRadius: 12, padding: '13px 14px', marginBottom: 12 },
    stationHead:  { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 },
    stationTitle: { margin: 0, fontSize: 11, fontWeight: 700, color: '#F47920', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'DM Sans', sans-serif" },
    stationName:  { margin: 0, fontSize: 14, fontWeight: 700, color: '#1E1B4B', fontFamily: "'DM Sans', sans-serif" },
    stationAddr:  { margin: '2px 0 0', fontSize: 12.5, color: '#475569', fontFamily: "'DM Sans', sans-serif" },
    stationDist:  { margin: '4px 0 0', fontSize: 11.5, color: '#F47920', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" },

    footnote: { margin: 0, fontSize: 11.5, color: '#64748B', textAlign: 'center', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" },
};

export default SOSButton;
