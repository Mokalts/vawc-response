import React from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import BottomNavbar from '../components/BottomNavbar';
import TermsContent from '../components/TermsContent';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id='vawc-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}

const IcoArrow = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" stroke="var(--accent-text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const IcoShield = () => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
    </svg>
);

/**
 * The privacy notice as a page, so it can be re-read at any time. RA 10173
 * gives the data subject a right to be informed; a notice shown once behind a
 * one-time consent modal does not really satisfy that.
 */
export default function Terms() {
    const navigate = useNavigate();

    return (
        <div style={S.page}>
            <header style={S.topBar}>
                <button style={S.backBtn} onClick={() => navigate(-1)} aria-label="Go back"><IcoArrow /></button>
                <h1 style={S.title}>Terms & Privacy</h1>
                <ThemeToggle size={44} />
            </header>

            <main style={S.content}>
                <div style={S.card}>
                    <div style={S.cardHead}>
                        <span style={S.headIcon}><IcoShield /></span>
                        <div style={{ minWidth: 0 }}>
                            <p style={S.headTitle}>Data Privacy Notice &amp; Terms</p>
                            <p style={S.headSub}>Republic Act 10173, Data Privacy Act of 2012</p>
                        </div>
                    </div>
                    <div style={S.body}>
                        <TermsContent />
                    </div>
                </div>

                <p style={S.footNote}>
                    You accepted this notice when you created your account. You may withdraw consent or
                    request a copy of your records at any time by contacting the Barangay Palanginan
                    Data Privacy Officer.
                </p>
            </main>

            <BottomNavbar />
        </div>
    );
}

const FF = "'Lexend', sans-serif";
const S = {
    page:      { minHeight:'100vh', background:'var(--page-grad)', color:'var(--text)', display:'flex', flexDirection:'column', paddingBottom:92, fontFamily:FF },
    topBar:    { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', backgroundColor:'var(--surface)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:100 },
    backBtn:   { width:44, height:44, borderRadius:10, backgroundColor:'var(--surface-tint)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
    title:     { fontSize:17, fontWeight:700, color:'var(--accent-text)', fontFamily:FF, margin:0 },
    // A reading page, so it is capped narrower than the browsing pages to keep
    // the measure comfortable.
    content:   { padding:'20px 18px', display:'flex', flexDirection:'column', gap:14, width:'100%', maxWidth:760, marginLeft:'auto', marginRight:'auto', boxSizing:'border-box' },
    card:      { backgroundColor:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', boxShadow:'var(--card-shadow)' },
    cardHead:  { display:'flex', alignItems:'center', gap:12, padding:'16px 18px', borderBottom:'1px solid var(--border)', background:'var(--surface-tint)' },
    headIcon:  { width:38, height:38, borderRadius:11, flexShrink:0, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--accent-text)', display:'inline-flex', alignItems:'center', justifyContent:'center' },
    headTitle: { margin:0, fontSize:15.5, fontWeight:800, color:'var(--text)', fontFamily:FF, letterSpacing:'-0.2px' },
    headSub:   { margin:'2px 0 0', fontSize:11.5, color:'var(--text-muted)', fontFamily:FF },
    body:      { padding:'20px 18px 8px' },
    footNote:  { margin:'0 4px', fontSize:12, color:'var(--text-muted)', lineHeight:1.6, textAlign:'center', fontFamily:FF },
};
