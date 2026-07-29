import React, { useState, useEffect, useRef } from 'react';

// ─── localStorage helpers (exported for use elsewhere) ──────────────────────
export const TERMS_KEY = 'vawc_terms_accepted';
export const hasAcceptedTerms = () => {
    try { return localStorage.getItem(TERMS_KEY) === 'true'; } catch { return false; }
};

// ─── Font + scoped CSS ──────────────────────────────────────────────────────
if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
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
        .terms-scroll::-webkit-scrollbar-track { background: #FFF3E0; border-radius: 4px; }
        .terms-scroll::-webkit-scrollbar-thumb { background: #FFCC99; border-radius: 4px; }
        .terms-scroll::-webkit-scrollbar-thumb:hover { background: #A78BFA; }
        .terms-accept:not([disabled]):hover { background: #C45E10 !important; box-shadow: 0 4px 14px rgba(196,94,16,0.35) !important; transform: translateY(-1px); }
        .terms-accept:not([disabled]):active { transform: scale(0.98); }
        .terms-decline:hover { background: #FFF3E0 !important; border-color: #FFCC99 !important; }
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

// ─── Section helper ─────────────────────────────────────────────────────────
const Section = ({ num, title, children }) => (
    <section style={S.section}>
        <div style={S.sectionHead}>
            <span style={S.sectionNum}>{num}</span>
            <h3 style={S.sectionTitle}>{title}</h3>
        </div>
        <div style={S.sectionBody}>{children}</div>
    </section>
);

const Bullet = ({ children }) => (
    <li style={S.bullet}><span style={S.bulletDot} />{children}</li>
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
                        <p style={S.headerSub}>Republic Act 10173 - Data Privacy Act of 2012</p>
                    </div>
                </header>

                {/* Progress bar */}
                <div style={S.progressTrack}>
                    <div style={{ ...S.progressFill, width: `${progress}%` }} />
                </div>

                {/* Scrollable content */}
                <div ref={scrollRef} className="terms-scroll" style={S.scroll} onScroll={handleScroll}>

                    <p style={S.intro}>
                        Welcome to <strong style={S.strong}>VAWC-Response</strong>, the official reporting system of
                        Barangay Palanginan, Iba, Zambales for cases of Violence Against Women and Children
                        under <strong style={S.strong}>Republic Act 9262</strong>. Please read this notice carefully before
                        creating an account.
                    </p>

                    <Section num="1" title="What information we collect">
                        <p style={S.para}>To process your reports and protect you, we collect:</p>
                        <ul style={S.list}>
                            <Bullet><strong>Identity & contact</strong> - name, email, phone number, birthdate, sex, address.</Bullet>
                            <Bullet><strong>Account credentials</strong> - encrypted password (never stored in plain text).</Bullet>
                            <Bullet><strong>Minor / guardian details</strong> - only if you indicate you are a minor.</Bullet>
                            <Bullet><strong>Case data</strong> - incident statement, photos, GPS or pinned location, offender name, incident type and date.</Bullet>
                        </ul>
                    </Section>

                    <Section num="2" title="Why we collect it (purpose)">
                        <p style={S.para}>Your data is used solely for:</p>
                        <ul style={S.list}>
                            <Bullet>Receiving, recording, and acting on your VAWC report.</Bullet>
                            <Bullet>Coordinating barangay response, mediation, and case follow-up.</Bullet>
                            <Bullet>Endorsing cases to the PNP Women & Children Protection Desk (WCPD), DSWD, or other proper authorities when escalation is necessary.</Bullet>
                            <Bullet>Sending you status notifications about your case via email.</Bullet>
                        </ul>
                        <p style={S.para}>We will <strong style={S.strong}>never</strong> sell, rent, or use your data for marketing.</p>
                    </Section>

                    <Section num="3" title="Who can access your data">
                        <ul style={S.list}>
                            <Bullet>Authorized barangay personnel (admins) handling your case.</Bullet>
                            <Bullet>The Punong Barangay and designated VAWC Desk officers.</Bullet>
                            <Bullet>Endorsed authorities (PNP-WCPD, DSWD, PAO) only when your case is officially referred.</Bullet>
                            <Bullet>You - at any time, through your account.</Bullet>
                        </ul>
                        <p style={S.para}>
                            Sensitive fields - your statement, location, and the offender's name - are
                            <strong style={S.strong}> encrypted at rest</strong> using Fernet symmetric encryption. Regular admins see
                            only masked previews; full content is visible only to authorized super admins.
                        </p>
                    </Section>

                    <Section num="4" title="How long we keep your data">
                        <ul style={S.list}>
                            <Bullet><strong>Active cases</strong> - retained while your case is open.</Bullet>
                            <Bullet><strong>Resolved or dismissed cases</strong> - kept as official records consistent with the National Privacy Commission and barangay records-management guidelines.</Bullet>
                            <Bullet><strong>Deleted accounts</strong> - soft-deleted records can be recovered within 30 days, after which they are permanently removed.</Bullet>
                        </ul>
                    </Section>

                    <Section num="5" title="Your rights under RA 10173">
                        <p style={S.para}>As the data subject, you have the right to:</p>
                        <ul style={S.list}>
                            <Bullet><strong>Be informed</strong> of how your data is processed.</Bullet>
                            <Bullet><strong>Access</strong> your personal data and the case records linked to it.</Bullet>
                            <Bullet><strong>Object</strong> to processing or withdraw consent (subject to existing legal obligations).</Bullet>
                            <Bullet><strong>Rectify</strong> inaccurate information through your profile or by contacting the barangay.</Bullet>
                            <Bullet><strong>Erasure or blocking</strong> of your data when there is no longer a legitimate purpose.</Bullet>
                            <Bullet><strong>Data portability</strong> - request a copy of your records.</Bullet>
                            <Bullet><strong>File a complaint</strong> with the National Privacy Commission (privacy.gov.ph).</Bullet>
                            <Bullet><strong>Be indemnified</strong> for damages caused by inaccurate, false, or unlawfully processed data.</Bullet>
                        </ul>
                    </Section>

                    <Section num="6" title="Security & confidentiality">
                        <p style={S.para}>
                            VAWC-Response uses field-level encryption, password hashing, encrypted login sessions, and
                            access controls to keep your information safe. Reports are treated with the strictest
                            confidentiality. Knowingly accessing, sharing, or tampering with these records is a
                            criminal offense under RA 10173 and RA 9262.
                        </p>
                    </Section>

                    <Section num="7" title="Contact for privacy concerns">
                        <p style={S.para}>
                            For questions, requests, or complaints regarding your personal data, contact the
                            Barangay Palanginan Data Privacy Officer through the barangay hall, or call the WCPD
                            hotline available on the home screen's <strong style={S.strong}>Emergency SOS</strong> button.
                        </p>
                    </Section>

                    <div style={S.acknowledge}>
                        <p style={S.ackTitle}>Acknowledgment</p>
                        <p style={S.ackText}>
                            By tapping <strong style={S.strong}>I Agree</strong>, you confirm that you have read and understood this Data
                            Privacy Notice, and you give your free and informed consent for VAWC-Response and
                            Barangay Palanginan to collect and process your personal information for the purposes
                            described above, in accordance with Republic Act 10173.
                        </p>
                    </div>

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
        padding: '16px', fontFamily: "'DM Sans', sans-serif",
    },
    modal: {
        background: '#fff', borderRadius: 16,
        width: '100%', maxWidth: 560, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(196,94,16,0.35)',
        border: '1px solid #FFE4CC',
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
    headerTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: '#fff', fontFamily: "'DM Sans', sans-serif" },
    headerSub:   { margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.85)', fontFamily: "'DM Sans', sans-serif" },

    progressTrack: { width: '100%', height: 4, background: '#FFF3E0' },
    progressFill:  { height: '100%', background: 'linear-gradient(90deg, #F47920 0%, #FB923C 100%)', transition: 'width 0.15s ease' },

    scroll: {
        flex: 1, overflowY: 'auto',
        padding: '20px 22px',
        background: '#FDFCFF',
    },
    intro: {
        margin: '0 0 18px', fontSize: 13.5, color: '#475569', lineHeight: 1.65,
        fontFamily: "'DM Sans', sans-serif",
    },
    strong: { color: '#C45E10', fontWeight: 700 },

    section: { marginBottom: 18, paddingLeft: 14, borderLeft: '3px solid #FFCC99' },
    sectionHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 },
    sectionNum: {
        flexShrink: 0, width: 24, height: 24, borderRadius: 7,
        background: '#F47920', color: '#fff',
        fontSize: 12, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif",
    },
    sectionTitle: { margin: 0, fontSize: 14.5, fontWeight: 800, color: '#1E1B4B', fontFamily: "'DM Sans', sans-serif" },
    sectionBody:  { fontSize: 13, color: '#475569', lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif" },

    para: { margin: '0 0 8px', fontSize: 13, color: '#475569', lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif" },
    list: { listStyle: 'none', margin: '0 0 8px', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
    bullet: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#475569', lineHeight: 1.55, fontFamily: "'DM Sans', sans-serif" },
    bulletDot: {
        flexShrink: 0, marginTop: 7, width: 6, height: 6, borderRadius: '50%',
        background: '#F47920',
    },

    acknowledge: {
        marginTop: 12, padding: '14px 16px',
        background: '#FFF3E0', border: '1.5px solid #FFCC99', borderRadius: 12,
    },
    ackTitle: { margin: 0, fontSize: 12, fontWeight: 800, color: '#9A3412', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, fontFamily: "'DM Sans', sans-serif" },
    ackText:  { margin: 0, fontSize: 12.5, color: '#7C2D12', lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" },

    scrollHint: {
        margin: '0 22px 10px', padding: '8px 12px',
        background: '#FFF3E0', border: '1px dashed #FFCC99', borderRadius: 8,
        color: '#F47920', fontSize: 12, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        alignSelf: 'flex-start',
    },

    footer: {
        display: 'flex', gap: 10,
        padding: '14px 20px 18px',
        borderTop: '1px solid #F1F5F9',
        background: '#fff',
    },
    declineBtn: {
        flex: 1, padding: '12px 16px',
        background: '#fff', color: '#475569',
        border: '1.5px solid #E2E8F0', borderRadius: 10,
        fontSize: 14, fontWeight: 700, cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
        transition: 'all 0.15s ease',
    },
    acceptBtn: {
        flex: 2, padding: '12px 16px',
        background: '#F47920', color: '#fff',
        border: 'none', borderRadius: 10,
        fontSize: 14, fontWeight: 800, cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
        transition: 'all 0.15s ease',
        boxShadow: '0 2px 8px rgba(244,121,32,0.25)',
    },
    acceptDisabled: {
        background: '#CBD5E1', color: '#fff',
        cursor: 'not-allowed', boxShadow: 'none',
    },
};

export default TermsModal;
