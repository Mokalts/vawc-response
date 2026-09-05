import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

// ─── Font + scoped CSS ──────────────────────────────────────────────────────
if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap';
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
        .sos-call:hover { filter: brightness(1.08); transform: scale(1.06); }
        .sos-overlay { animation: sosFadeIn 0.18s ease; }
        .sos-modal   { animation: sosSlideUp 0.22s ease; }
        .sos-close:hover { filter: brightness(0.96); }
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
    const modalRef = useRef(null);
    const lastFocusedRef = useRef(null);

    // Lock body scroll while modal open + ESC to close + focus trap + focus restore
    useEffect(() => {
        if (!open) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        lastFocusedRef.current = document.activeElement;

        // Move focus into the dialog once it has mounted.
        const focusTimer = setTimeout(() => {
            const first = modalRef.current?.querySelector('button, a[href], input, [tabindex]:not([tabindex="-1"])');
            first?.focus();
        }, 0);

        const onKey = (e) => {
            if (e.key === 'Escape') { setOpen(false); return; }
            if (e.key !== 'Tab' || !modalRef.current) return;
            // Trap Tab within the dialog.
            const focusables = modalRef.current.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])');
            if (!focusables.length) return;
            const firstEl = focusables[0];
            const lastEl = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
            else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
        };
        window.addEventListener('keydown', onKey);

        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKey);
            clearTimeout(focusTimer);
            // Restore focus to whatever opened the dialog.
            if (lastFocusedRef.current && lastFocusedRef.current.focus) lastFocusedRef.current.focus();
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
                    <div ref={modalRef} className="sos-modal" style={S.modal} onClick={e => e.stopPropagation()}>

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
                                    <div style={{ ...S.cardIcon, background: 'var(--surface-tint)' }}>
                                        <IcoPhone c="#C45E10" />
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <p style={S.cardLabel}>{h.label}</p>
                                        <p style={{ ...S.cardNumber, ...(h.test ? { color: 'var(--text-muted)' } : {}) }}>{h.display}</p>
                                        <p style={{ ...S.cardDesc, ...(h.test ? { fontStyle: 'italic' } : {}) }}>{h.desc}</p>
                                    </div>
                                    <span className="sos-call" style={S.callBtn} aria-hidden="true">
                                        <IcoPhone />
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
        fontFamily: "'Lexend', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase',
        boxShadow: '0 8px 22px rgba(220,38,38,0.28)',
    },
    compactBtn: {
        padding: '11px 18px',
        background: 'linear-gradient(135deg, #F47920 0%, #DC2626 100%)',
        color: '#fff', fontSize: 13, fontWeight: 700,
        border: 'none', borderRadius: 9999, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontFamily: "'Lexend', sans-serif", letterSpacing: '0.03em', textTransform: 'uppercase',
        boxShadow: '0 6px 16px rgba(220,38,38,0.22)',
    },

    // ── Modal
    overlay: {
        position: 'fixed', inset: 0, backgroundColor: 'var(--overlay)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 14px', backdropFilter: 'blur(4px)',
    },
    modal: {
        background: 'var(--surface)', borderRadius: 24,
        width: '100%', maxWidth: 460, maxHeight: '88vh', overflowY: 'auto',
        padding: '24px 20px 22px',
        boxShadow: 'var(--card-shadow-strong)',
        border: '1px solid var(--border)',
    },
    modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
    modalTitle:  { margin: 0, fontSize: 19, fontWeight: 700, color: 'var(--accent-text)', fontFamily: "'Lexend', sans-serif" },
    modalSub:    { margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: "'Lexend', sans-serif" },
    closeBtn:    { width: 44, height: 44, borderRadius: 10, background: 'var(--surface-tint)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },

    // ── Hotline cards
    list: { display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 },
    card: {
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 14px', background: 'var(--surface)',
        border: '1.5px solid var(--border)', borderRadius: 16,
        textDecoration: 'none', cursor: 'pointer',
    },
    cardPriority: { background: 'var(--surface-tint)', borderColor: '#FFCC99', boxShadow: '0 4px 14px rgba(196,94,16,0.1)' },
    cardIcon:     { width: 40, height: 40, borderRadius: 12, flexShrink: 0, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    cardLabel:    { margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, fontFamily: "'Lexend', sans-serif", overflowWrap: 'break-word' },
    cardNumber:   { margin: '2px 0 1px', fontSize: 15, fontWeight: 800, color: 'var(--accent-text)', letterSpacing: '0.2px', lineHeight: 1.2, fontFamily: "'Lexend', sans-serif" },
    cardDesc:     { margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4, fontFamily: "'Lexend', sans-serif" },
    callBtn:      {
        width: 44, height: 44, borderRadius: '50%',
        background: '#16A34A', color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, alignSelf: 'center',
        boxShadow: '0 3px 10px rgba(22,163,74,0.3)',
        transition: 'transform 0.15s ease, filter 0.15s ease',
    },

    // ── Nearest station
    station:      { background: 'var(--surface-tint)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '13px 14px', marginBottom: 12 },
    stationHead:  { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 },
    stationTitle: { margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: "'Lexend', sans-serif" },
    stationName:  { margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: "'Lexend', sans-serif" },
    stationAddr:  { margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-body)', fontFamily: "'Lexend', sans-serif" },
    stationDist:  { margin: '4px 0 0', fontSize: 11.5, color: 'var(--accent-text)', fontWeight: 600, fontFamily: "'Lexend', sans-serif" },

    footnote: { margin: 0, fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5, fontFamily: "'Lexend', sans-serif" },
};

export default SOSButton;
