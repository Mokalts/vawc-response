import React from 'react';
import { useNavigate } from 'react-router-dom';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-contact-css')) {
    const s = document.createElement('style'); s.id = 'vawc-contact-css';
    s.textContent = `
        .vc-contact-row { transition: background-color 0.12s ease; }
        .vc-contact-row:active { background-color: #FFF3E0; }
        .vc-back-btn { transition: transform 0.12s ease; }
        .vc-back-btn:hover { transform: translateX(-2px); }
    `;
    document.head.appendChild(s);
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IcoBack    = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#C45E10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoPhone   = ({ c='#059669' }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoMail    = ({ c='#9B4DAB' }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={c} strokeWidth="1.8" strokeLinecap="round"/><polyline points="22,6 12,13 2,6" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoShield  = ({ c='#C45E10' }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoAlert   = ({ c='#D97706' }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke={c} strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke={c} strokeWidth="2.4" strokeLinecap="round"/></svg>);
const IcoChevron = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#CBD5E1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);

const contacts = [
    { icon: <IcoPhone c="#991B1B" />, iconBg: '#FEF2F2', label: 'PNP Emergency Hotline', value: '911', sub: 'For immediate danger - call first' },
    { icon: <IcoShield c="#C45E10" />, iconBg: '#FFF3E0', label: 'PNP Women & Children Protection Desk', value: '1800-188-PNP-107', sub: 'VAWC case handling with confidentiality' },
    { icon: <IcoPhone c="#059669" />, iconBg: '#ECFDF5', label: 'DSWD Action Center', value: '8-951-2803', sub: 'Shelter, counseling, legal assistance' },
    { icon: <IcoPhone c="#9B4DAB" />, iconBg: '#F3E5F5', label: 'NBI Hotline', value: '8523-8231', sub: 'National Bureau of Investigation' },
    { icon: <IcoShield c="#C45E10" />, iconBg: '#FFF3E0', label: 'Public Attorney\'s Office (PAO)', value: '(02) 8929-9436', sub: 'Free legal assistance' },
    { icon: <IcoMail />, iconBg: '#F3E5F5', label: 'Email Support', value: 'support@vawcresponse.gov.ph', sub: 'Non-urgent inquiries' },
    { icon: <IcoShield c="#C45E10" />, iconBg: '#FFF3E0', label: 'Barangay VAWC Desk', value: 'Contact your local barangay hall', sub: 'Available 24/7 - required by RA 9262' },
];

function ContactUs() {
    const navigate = useNavigate();

    return (
        <div style={S.page}>

            {/* Top bar */}
            <header style={S.topBar}>
                <button className="vc-back-btn" style={S.backBtn} onClick={() => navigate('/home')}>
                    <IcoBack />
                </button>
                <h1 style={S.title}>Contact & Help</h1>
                <div style={{ width: 36 }} />
            </header>

            <main style={S.content}>

                {/* Emergency card */}
                <div style={S.emergencyCard}>
                    <div style={S.emergencyLeft}>
                        <div style={S.emergencyIconBox}><IcoAlert c="#fff" /></div>
                        <div>
                            <p style={S.emergencyLabel}>Emergency Hotline</p>
                            <p style={S.emergencyNumber}>911</p>
                            <p style={S.emergencyDesc}>If you are in immediate danger, call 911 right away. Do not wait.</p>
                        </div>
                    </div>
                </div>

                {/* Contacts card */}
                <div style={S.card}>
                    <p style={S.cardTitle}>Support Lines</p>
                    {contacts.map((c, i) => (
                        <div key={i}>
                            <div className="vc-contact-row" style={S.row}>
                                <div style={{ ...S.rowIcon, backgroundColor: c.iconBg }}>{c.icon}</div>
                                <div style={S.rowBody}>
                                    <p style={S.rowLabel}>{c.label}</p>
                                    <p style={S.rowValue}>{c.value}</p>
                                    {c.sub && <p style={S.rowSub}>{c.sub}</p>}
                                </div>
                                <IcoChevron />
                            </div>
                            {i < contacts.length - 1 && <div style={S.divider} />}
                        </div>
                    ))}
                </div>

                {/* Note */}
                <div style={S.noteBox}>
                    <div style={S.noteIconRow}>
                        <IcoShield c="#C45E10" />
                        <p style={S.noteTitle}>Your reports are confidential</p>
                    </div>
                    <p style={S.noteText}>
                        Under Republic Act 9262, all reports and communications are kept strictly confidential
                        by government agencies. You are protected by law. You are not alone - help is available
                        and you deserve to be safe.
                    </p>
                </div>

            </main>
        </div>
    );
}

const S = {
    page:           { minHeight: '100vh', backgroundColor: '#FFF3E0', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" },
    topBar:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', backgroundColor: '#fff', borderBottom: '1px solid #FFE4CC', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 8px rgba(244,121,32,0.06)' },
    backBtn:        { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF3E0', border: '1.5px solid #FFE4CC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    title:          { fontSize: 17, fontWeight: 700, color: '#C45E10', fontFamily: "'DM Sans', sans-serif" },
    content:        { padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 },

    emergencyCard:  { backgroundColor: '#991B1B', borderRadius: 4, padding: '20px', boxShadow: '0 4px 16px rgba(153,27,27,0.3)' },
    emergencyLeft:  { display: 'flex', gap: 16, alignItems: 'flex-start' },
    emergencyIconBox:{ width: 40, height: 40, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    emergencyLabel: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4, fontFamily: "'DM Sans', sans-serif" },
    emergencyNumber:{ fontSize: 40, fontWeight: 800, color: '#fff', lineHeight: 1, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" },
    emergencyDesc:  { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" },

    card:           { backgroundColor: '#fff', borderRadius: 12, padding: '20px 20px 8px', boxShadow: '0 2px 10px rgba(244,121,32,0.06)', border: '1px solid #FFE4CC' },
    cardTitle:      { fontSize: 13, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 14, fontFamily: "'DM Sans', sans-serif" },
    row:            { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', cursor: 'pointer', borderRadius: 4},
    rowIcon:        { width: 36, height: 36, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    rowBody:        { flex: 1 },
    rowLabel:       { fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 2, fontFamily: "'DM Sans', sans-serif" },
    rowValue:       { fontSize: 14.5, fontWeight: 700, color: '#0F172A', marginBottom: 2, fontFamily: "'DM Sans', sans-serif" },
    rowSub:         { fontSize: 11.5, color: '#94A3B8', fontFamily: "'DM Sans', sans-serif" },
    divider:        { height: 1, backgroundColor: '#F1F5F9', marginLeft: 50 },

    noteBox:        { backgroundColor: '#fff', borderRadius: 4, padding: '18px 20px', border: '1.5px solid #FFE4CC' },
    noteIconRow:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
    noteTitle:      { fontSize: 13.5, fontWeight: 700, color: '#C45E10', fontFamily: "'DM Sans', sans-serif" },
    noteText:       { fontSize: 13, color: '#475569', lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" },
};

export default ContactUs;
