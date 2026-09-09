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
        @keyframes sosFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes sosSlideUp { from{opacity:0; transform:translateY(20px)} to{opacity:1; transform:translateY(0)} }
        /* No idle pulse. A control that throbs forever reads as decoration and
           competes with the report CTA; the size and colour already carry it. */
        .sos-btn { transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease; }
        .sos-btn:hover  { transform: translateY(-1px); filter: brightness(1.05); box-shadow: 0 12px 26px rgba(185,28,28,0.32); }
        .sos-btn:active { transform: scale(0.98); }
        /* Rows separate by whitespace; hover is a background wash, not a border. */
        .sos-row { transition: background 0.18s ease; }
        .sos-row:hover { background: var(--surface-alt); }
        .sos-row:active { background: var(--surface-tint); }
        .sos-row:hover .sos-call, .sos-row:focus-visible .sos-call { background: #DC2626; border-color: #DC2626; color: #fff; }
        .sos-overlay { animation: sosFadeIn 0.18s ease; }
        .sos-modal   { animation: sosSlideUp 0.22s ease; }
        .sos-close { transition: background 0.15s ease; }
        .sos-close:hover { background: var(--surface-alt); }
    `;
    document.head.appendChild(s);
}

// ─── Icons ──────────────────────────────────────────────────────────────────
// Each hotline gets its own glyph. A single generic phone icon repeated down the
// list tells the reader nothing and makes the rows blur together.
const IcoSOS    = ({ size = 22, c = '#fff' }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 8v5M12 16h.01" stroke={c} strokeWidth="2.4" strokeLinecap="round" /></svg>);
const IcoX      = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" style={{ stroke: 'var(--text-muted)' }} strokeWidth="2" strokeLinecap="round" /></svg>);
const IcoPhone  = ({ c = '#fff', size = 14 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
// Police: badge shield with a star
const IcoBadge  = ({ c }) => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 21.5s7-3.4 7-8.6V5.6L12 2.5 5 5.6v7.3c0 5.2 7 8.6 7 8.6z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" /><path d="M12 8.2l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4L12 8.2z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></svg>);
// Barangay desk officer: person at a counter
const IcoDesk   = ({ c }) => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="6.5" r="3" stroke={c} strokeWidth="1.8" /><path d="M6.5 15.5a5.5 5.5 0 0111 0" stroke={c} strokeWidth="1.8" strokeLinecap="round" /><path d="M3 18.5h18M5.5 18.5v3M18.5 18.5v3" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>);
// Social welfare: hand holding a heart
const IcoCare   = ({ c }) => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 9.3l-.9-.9a2.3 2.3 0 10-3.2 3.2l4.1 4 4.1-4a2.3 2.3 0 10-3.2-3.2l-.9.9z" stroke={c} strokeWidth="1.7" strokeLinejoin="round" /><path d="M3.5 17.5c1.8 2 4.4 3.2 8.5 3.2s6.7-1.2 8.5-3.2" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>);
// Test line: a lab flask, clearly not an official service
const IcoFlask  = ({ c }) => (<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M9.5 3v6.2L4.6 17a2 2 0 001.7 3h11.4a2 2 0 001.7-3l-4.9-7.8V3" stroke={c} strokeWidth="1.8" strokeLinejoin="round" /><path d="M8.5 3h7M7.3 14h9.4" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>);

// ─── Hotlines (edit values for production) ──────────────────────────────────
const HOTLINES = [
    { label: 'PNP Emergency',                 dial: '911',           display: '911',           desc: 'Police response for Iba, Zambales and nationwide.',     icon: IcoBadge, critical: true },
    { label: 'Barangay Palanginan VAWC Desk', dial: '+639286673772', display: '0928 667 3772', desc: 'Ms. Maria Theresa M. De Leon, Admin Assistant.',        icon: IcoDesk },
    { label: 'DSWD Hotline',                  dial: '1343',          display: '1343',          desc: 'Open 24/7 for violence and trafficking cases.',         icon: IcoCare },
    { label: 'Test Number',                   dial: '+639085267335', display: '0908 526 7335', desc: 'System testing only. This is not an official hotline.', icon: IcoFlask, test: true },
];

// One accent for the whole panel. Reserved for the call actions and the 911
// number, so the eye lands on what to do rather than on four competing colours.
const ACCENT = '#DC2626';

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

    const isCompact = variant === 'compact';

    return (
        <>
            {isCompact ? (
                <button type="button" className="sos-btn" style={S.compactBtn} onClick={() => setOpen(true)} aria-label="Open emergency hotlines">
                    <IcoSOS size={17} />
                    <span>Hotlines</span>
                </button>
            ) : (
                <div>
                    <button type="button" className="sos-btn" style={S.blockBtn} onClick={() => setOpen(true)} aria-describedby="sos-caption">
                        <IcoPhone size={18} />
                        <span>Hotlines</span>
                    </button>
                    {/* The explanation sits under the button, not inside it, so the
                        button keeps a single confident line. */}
                    <p id="sos-caption" style={S.blockCaption}>
                        Police, VAWC desk, and DSWD. Works even without signing in.
                    </p>
                </div>
            )}

            {open && ReactDOM.createPortal(
                <div className="sos-overlay" style={S.overlay} onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-labelledby="sos-title">
                    <div ref={modalRef} className="sos-modal" style={S.modal} onClick={e => e.stopPropagation()}>

                        <div style={S.modalHeader}>
                            <div>
                                <p id="sos-title" style={S.modalTitle}>Emergency Hotlines</p>
                                <p style={S.modalSub}>Tap any number to call</p>
                            </div>
                            <button type="button" className="sos-close" style={S.closeBtn} onClick={() => setOpen(false)} aria-label="Close">
                                <IcoX />
                            </button>
                        </div>

                        <div style={S.list}>
                            {HOTLINES.map(h => {
                                const Ico = h.icon;
                                return (
                                    <a
                                        key={h.dial}
                                        href={`tel:${h.dial}`}
                                        className="sos-row"
                                        style={{ ...S.row, ...(h.test ? { opacity: 0.62 } : {}) }}
                                        aria-label={`Call ${h.label} at ${h.display}`}
                                    >
                                        <span style={S.rowIcon} aria-hidden="true"><Ico c="var(--text-body)" /></span>
                                        <span style={{ minWidth: 0, flex: 1 }}>
                                            <span style={{ ...S.rowNumber, ...(h.critical ? { color: ACCENT } : {}) }}>{h.display}</span>
                                            <span style={S.rowLabel}>{h.label}</span>
                                            <span style={S.rowDesc}>{h.desc}</span>
                                        </span>
                                        <span className="sos-call" style={S.callBtn} aria-hidden="true">
                                            <IcoPhone size={12.5} c="currentColor" /> Call
                                        </span>
                                    </a>
                                );
                            })}
                        </div>

                        <p style={S.footnote}>
                            In immediate danger, call <strong style={{ color: ACCENT, fontWeight: 700 }}>911</strong> first and stay on the line until help arrives.
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
    // One line, centred, tall. A CTA has to read as pressable at a glance; the
    // inset top highlight gives it a lit edge without adding another element.
    blockBtn: {
        width: '100%', minHeight: 56, padding: '0 20px',
        background: 'linear-gradient(180deg, #DC2626 0%, #B0181C 100%)',
        color: '#fff', fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.2px',
        border: 'none', borderRadius: 14, cursor: 'pointer', touchAction: 'manipulation',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        fontFamily: "'Lexend', sans-serif",
        boxShadow: '0 10px 24px rgba(176,24,28,0.34), inset 0 1px 0 rgba(255,255,255,0.28)',
    },
    blockCaption: {
        margin: '9px 2px 0', fontSize: 11.5, lineHeight: 1.5,
        color: 'var(--text-muted)', textAlign: 'center', fontFamily: "'Lexend', sans-serif",
    },
    compactBtn: {
        minHeight: 44, padding: '10px 16px',
        background: 'linear-gradient(135deg, #E8641C 0%, #B91C1C 100%)',
        color: '#fff', fontSize: 13, fontWeight: 700,
        border: 'none', borderRadius: 9999, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        fontFamily: "'Lexend', sans-serif", letterSpacing: '0.01em',
        boxShadow: '0 6px 16px rgba(185,28,28,0.22)',
    },

    // ── Modal
    overlay: {
        position: 'fixed', inset: 0, backgroundColor: 'var(--overlay)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 14px', backdropFilter: 'blur(4px)',
    },
    modal: {
        background: 'var(--surface)', borderRadius: 20,
        width: '100%', maxWidth: 440, maxHeight: '88vh', overflowY: 'auto',
        padding: '26px 22px 22px',
        boxShadow: 'var(--card-shadow-strong)',
        border: '1px solid var(--border)',
    },
    modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 22 },
    modalTitle:  { margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text)', fontFamily: "'Lexend', sans-serif" },
    modalSub:    { margin: '4px 0 0', fontSize: 12.5, fontWeight: 400, color: 'var(--text-muted)', fontFamily: "'Lexend', sans-serif" },
    // Borderless close: the X is enough, a boxed button competes with the rows.
    closeBtn:    { width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginRight: -6, marginTop: -4 },

    // ── Hotline rows
    // No per-item borders. Four outlined boxes inside an outlined modal is
    // nested chrome; the separation comes from space and a hover wash instead.
    list: { display: 'flex', flexDirection: 'column', marginBottom: 20 },
    row: {
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '15px 10px', margin: '0 -6px', borderRadius: 12,
        background: 'transparent', border: 'none',
        textDecoration: 'none', cursor: 'pointer',
    },
    // Soft monochrome disc: uniform across every row so the glyph reads as an
    // identifier, not as a second colour signal.
    rowIcon: {
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: 'var(--surface-alt)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    // The number carries the hierarchy; everything else recedes. It is sized
    // with clamp and never wraps: a phone number broken across two lines is
    // harder to read than a smaller one that stays intact.
    rowNumber: { display: 'block', fontSize: 'clamp(17px, 5.2vw, 21px)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.2px', lineHeight: 1.15, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontFamily: "'Lexend', sans-serif" },
    rowLabel:  { display: 'block', margin: '3px 0 0', fontSize: 12.5, fontWeight: 500, color: 'var(--text-body)', lineHeight: 1.35, fontFamily: "'Lexend', sans-serif", overflowWrap: 'break-word' },
    rowDesc:   { display: 'block', margin: '2px 0 0', fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', lineHeight: 1.45, fontFamily: "'Lexend', sans-serif" },
    callBtn: {
        minHeight: 36, padding: '0 13px', borderRadius: 9999,
        background: 'transparent', border: `1.5px solid ${ACCENT}40`,
        color: ACCENT, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.01em',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        flexShrink: 0, alignSelf: 'center', fontFamily: "'Lexend', sans-serif",
        transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
    },

    footnote: { margin: 0, fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.55, fontFamily: "'Lexend', sans-serif" },
};

export default SOSButton;
