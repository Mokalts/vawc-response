import TermsContent from './TermsContent';
import React, { useState, useEffect, useRef } from 'react';

// ─── localStorage helpers (exported for use elsewhere) ──────────────────────
export const TERMS_KEY = 'vawc_terms_accepted';
export const hasAcceptedTerms = () => {
    try { return localStorage.getItem(TERMS_KEY) === 'true'; } catch { return false; }
};

// ─── Font + scoped CSS ──────────────────────────────────────────────────────
if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-terms-css')) {
    const s = document.createElement('style'); s.id = 'vawc-terms-css';
    s.textContent = `
        @keyframes termsFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes termsSlideUp { from{opacity:0; transform:translateY(20px)} to{opacity:1; transform:translateY(0)} }
        .terms-overlay { animation: termsFadeIn 0.18s ease; }
        .terms-modal   { animation: termsSlideUp 0.22s ease; }
        .terms-scroll::-webkit-scrollbar { width: 8px; }
        .terms-scroll::-webkit-scrollbar-track { background: var(--surface-tint); border-radius: 4px; }
        .terms-scroll::-webkit-scrollbar-thumb { background: #FFCC99; border-radius: 4px; }
        .terms-scroll::-webkit-scrollbar-thumb:hover { background: #F47920; }
        .terms-accept:not([disabled]):hover { background: #C45E10 !important; box-shadow: 0 4px 14px rgba(196,94,16,0.35) !important; transform: translateY(-1px); }
        .terms-accept:not([disabled]):active { transform: scale(0.98); }
        .terms-decline:hover { background: var(--surface-tint) !important; border-color: #FFCC99 !important; }
    `;
    document.head.appendChild(s);
}

// ─── Icons ──────────────────────────────────────────────────────────────────
const IcoLockShield = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="9" y="10" width="6" height="5" rx="1" stroke="#fff" strokeWidth="1.6" />
        <path d="M10.5 10V8.5a1.5 1.5 0 013 0V10" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);
const IcoArrowDown = ({ c = '#F47920' }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M19 12l-7 7-7-7" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);


// ─── Main component ─────────────────────────────────────────────────────────
function TermsModal({ open, onAccept, onDecline }) {
    const [scrolledToBottom, setScrolledToBottom] = useState(false);
    const [progress, setProgress] = useState(0);
    const scrollRef = useRef(null);

    // Reset + lock body scroll on open
    useEffect(() => {
        if (!open) return;
        setScrolledToBottom(false);
        setProgress(0);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        // ensure scroll area starts at top
        requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; });
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    // ESC = decline
    useEffect(() => {
        if (!open) return;
        const onKey = e => { if (e.key === 'Escape') onDecline(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onDecline]);

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const scrollable = el.scrollHeight - el.clientHeight;
        if (scrollable <= 0) {
            setProgress(100);
            setScrolledToBottom(true);
            return;
        }
        const ratio = Math.min(1, el.scrollTop / scrollable);
        setProgress(Math.round(ratio * 100));
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 8) {
            setScrolledToBottom(true);
        }
    };

    const handleAccept = () => {
        try { localStorage.setItem(TERMS_KEY, 'true'); } catch {}
        onAccept();
    };

    const scrollDown = () => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollBy({ top: el.clientHeight - 40, behavior: 'smooth' });
    };

    if (!open) return null;

    return (
        <div className="terms-overlay" style={S.overlay} role="dialog" aria-modal="true" aria-labelledby="terms-title">
            <div className="terms-modal" style={S.modal}>

                {/* Header */}
                <header style={S.header}>
                    <div style={S.headerIcon}><IcoLockShield /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p id="terms-title" style={S.headerTitle}>Data Privacy Notice & Terms</p>
                        <p style={S.headerSub}>Republic Act 10173, Data Privacy Act of 2012</p>
                    </div>
                </header>

                {/* Progress bar */}
                <div style={S.progressTrack}>
                    <div style={{ ...S.progressFill, width: `${progress}%` }} />
                </div>

                {/* Scrollable content */}
                <div ref={scrollRef} className="terms-scroll" style={S.scroll} onScroll={handleScroll}>

                    <TermsContent showAcknowledgment variant="modal" />

                </div>

                {/* Scroll hint when not at bottom */}
                {!scrolledToBottom && (
                    <button type="button" style={S.scrollHint} onClick={scrollDown}>
                        <IcoArrowDown />
                        <span>Scroll to read all sections</span>
                    </button>
                )}

                {/* Footer actions */}
                <footer style={S.footer}>
                    <button type="button" className="terms-decline" style={S.declineBtn} onClick={onDecline}>
                        Decline
                    </button>
                    <button
                        type="button"
                        className="terms-accept"
                        style={{ ...S.acceptBtn, ...(scrolledToBottom ? {} : S.acceptDisabled) }}
                        onClick={handleAccept}
                        disabled={!scrolledToBottom}
                    >
                        {scrolledToBottom ? 'I Agree & Continue' : 'Scroll to bottom to enable'}
                    </button>
                </footer>

            </div>
        </div>
    );
}

const S = {
    overlay: {
        position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)',
        zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', fontFamily: "'Lexend', sans-serif",
    },
    modal: {
        background: 'var(--surface)', borderRadius: 16,
        width: '100%', maxWidth: 560, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(196,94,16,0.35)',
        border: '1px solid var(--border)',
    },

    header: {
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '18px 20px',
        background: 'linear-gradient(135deg, #F47920 0%, #C45E10 100%)',
    },
    headerIcon: {
        width: 42, height: 42, borderRadius: 10,
        background: 'rgba(255,255,255,0.18)',
        border: '1px solid rgba(255,255,255,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    headerTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: '#fff', fontFamily: "'Lexend', sans-serif" },
    headerSub:   { margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.85)', fontFamily: "'Lexend', sans-serif" },

    progressTrack: { width: '100%', height: 4, background: 'var(--surface-tint)' },
    progressFill:  { height: '100%', background: 'linear-gradient(90deg, #F47920 0%, #FB923C 100%)', transition: 'width 0.15s ease' },

    scroll: {
        flex: 1, overflowY: 'auto',
        padding: '20px 22px',
        background: 'var(--surface)',
    },
    scrollHint: {
        margin: '0 22px 10px', padding: '8px 12px',
        background: 'var(--surface-tint)', border: '1px dashed #FFCC99', borderRadius: 8,
        color: 'var(--accent-text)', fontSize: 12, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        cursor: 'pointer', fontFamily: "'Lexend', sans-serif",
        alignSelf: 'flex-start',
    },

    footer: {
        display: 'flex', gap: 10,
        padding: '14px 20px 18px',
        borderTop: '1px solid var(--border-soft)',
        background: 'var(--surface)',
    },
    declineBtn: {
        flex: 1, padding: '12px 16px',
        background: 'var(--surface)', color: 'var(--text-body)',
        border: '1.5px solid var(--border)', borderRadius: 10,
        fontSize: 14, fontWeight: 700, cursor: 'pointer',
        fontFamily: "'Lexend', sans-serif",
        transition: 'all 0.15s ease',
    },
    acceptBtn: {
        flex: 2, padding: '12px 16px',
        background: '#F47920', color: '#fff',
        border: 'none', borderRadius: 10,
        fontSize: 14, fontWeight: 800, cursor: 'pointer',
        fontFamily: "'Lexend', sans-serif",
        transition: 'all 0.15s ease',
        boxShadow: '0 2px 8px rgba(244,121,32,0.25)',
    },
    acceptDisabled: {
        background: '#CBD5E1', color: '#fff',
        cursor: 'not-allowed', boxShadow: 'none',
    },
};

export default TermsModal;
