import React from 'react';
import { AdminLayout } from '../components/Sidebar';
import { COLORS, RADIUS } from '../theme';

/**
 * Terms of Use and Data Handling for barangay staff.
 *
 * Deliberately NOT the victim-facing privacy notice. That one tells a data
 * subject what happens to her information; this one tells an officer what they
 * are obliged to do with it. Same laws, opposite side of the relationship.
 *
 * The obligations restate duties that already exist in RA 9262, RA 10173,
 * JMC 2010-2 and the Barangay VAW Desk Handbook; the system does not create
 * them. Have the barangay's data protection officer or the adviser review the
 * wording before it is adopted as policy.
 */

if (!document.getElementById('adm-terms-css')) {
    const s = document.createElement('style'); s.id = 'adm-terms-css';
    s.textContent = `
        .adm-toc a { transition: background-color 0.15s ease, color 0.15s ease; }
        .adm-toc a:hover { background: var(--adm-muted); color: var(--adm-text); }
    `;
    document.head.appendChild(s);
}

const LAST_UPDATED = '13 September 2026';

const SECTIONS = [
    {
        id: 'adm-terms-access', title: 'Authorized access only',
        items: [
            'Your account is personal. Do not share your credentials, and do not let another person act under your account.',
            'Open a case record only when you have a duty to act on it. Browsing records out of curiosity is a breach, even without disclosure.',
            'Face verification is a second factor, not a formality. Do not bypass or delegate it.',
        ],
    },
    {
        id: 'adm-terms-confidentiality', title: 'Confidentiality',
        items: [
            'Section 44 of RA 9262 makes it punishable to disclose the identity of a victim or the circumstances of her case. This includes conversation, messaging apps, and photographs of your screen.',
            'Printed forms, BPO applications, and endorsement letters are confidential documents. Do not leave them on a desk or in a shared printer tray.',
            'Discuss a case only with personnel who have a role in it, and only where you cannot be overheard.',
        ],
    },
    {
        id: 'adm-terms-record', title: 'The barangay records, it does not adjudicate',
        items: [
            'RA 9262 and Joint Memorandum Circular 2010-2 prohibit mediation, conciliation, arbitration, and amicable settlement of VAWC cases at the barangay level.',
            'Do not summon the respondent to a settlement meeting, and do not issue a Certificate to File Action for a VAWC case.',
            'Ending barangay assistance is not closing or dismissing a case; only a court can do that. Record a reason, and never record an outcome as resolved or settled.',
        ],
    },
    {
        id: 'adm-terms-accuracy', title: 'Accuracy of records',
        items: [
            'What you enter becomes part of an official record and may be printed on a Barangay Protection Order or an endorsement letter. Correct a misspelled name rather than leaving it.',
            'Classify an incident from the complainant\'s statement. If the statement does not support a classification, ask her rather than guess.',
            'Record the date and time of mandatory reporting to the PNP and the C/MSWDO accurately. JMC 2010-2 sets a four-hour expectation, and a falsified timestamp is worse than a late one.',
        ],
    },
    {
        id: 'adm-terms-data', title: 'Data protection under RA 10173',
        items: [
            'Statements, locations, respondent names, and minors\' details are encrypted at rest. Do not copy them into spreadsheets, personal email, or messaging apps.',
            'Regular admins see masked previews. If you can see a full record, you are accountable for it.',
            'Export or print only what a specific task requires, and dispose of printed copies securely.',
            'Report a suspected breach to the Punong Barangay and the barangay\'s data protection officer immediately.',
        ],
    },
    {
        id: 'adm-terms-accountability', title: 'Accountability',
        items: [
            'Actions in this portal are attributed to your account, including status changes, messages to the complainant, and deletions.',
            'Misuse may carry administrative liability, and criminal liability under RA 9262 or RA 10173.',
            'A barangay official who initiates mediation or reconciliation in a VAWC case is administratively liable, as the Barangay VAW Desk Handbook states.',
        ],
    },
];

export default function Terms() {
    const jump = (e, id) => {
        e.preventDefault();
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    };

    return (
        <AdminLayout title="Terms & Data Handling" breadcrumbs={['Terms & Data Handling']}>
            <div style={S.column}>

                <div style={S.heading}>
                    <p style={S.kicker}>For authorized personnel</p>
                    <h2 style={S.h}>Terms of Use and Data Handling</h2>
                    <p style={S.sub}>Barangay Palanginan VAW Desk · Last updated {LAST_UPDATED}</p>
                </div>

                <nav className="adm-toc" aria-label="On this page" style={S.toc}>
                    <p style={S.tocLabel}>On this page</p>
                    <ol style={S.tocList}>
                        {SECTIONS.map((s, i) => (
                            <li key={s.id}>
                                <a href={`#${s.id}`} onClick={(e) => jump(e, s.id)} style={S.tocLink}>
                                    <span style={S.tocNum} aria-hidden="true">{i + 1}</span>
                                    <span>{s.title}</span>
                                </a>
                            </li>
                        ))}
                    </ol>
                </nav>

                <article style={S.card}>
                    <div style={S.accent} aria-hidden="true" />
                    <div style={S.body}>
                        <p style={S.intro}>
                            This portal holds the personal and case data of women and children who have reported
                            violence. Access is a duty, not a convenience. By signing in you accept the obligations
                            below.
                        </p>

                        {SECTIONS.map((sec, i) => (
                            <section key={sec.id} id={sec.id} style={{ ...S.section, ...(i === 0 ? S.sectionFirst : null) }}>
                                <div style={S.sectionHead}>
                                    <span style={S.num} aria-hidden="true">{i + 1}</span>
                                    <h3 style={S.sectionTitle}>{sec.title}</h3>
                                </div>
                                <ul style={S.list}>
                                    {sec.items.map((t, j) => (
                                        <li key={j} style={S.item}>
                                            <span style={S.dot} aria-hidden="true" />
                                            <span style={S.itemText}>{t}</span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}

                        <div style={S.review}>
                            <p style={S.reviewTitle}>Review before adoption</p>
                            <p style={S.reviewText}>
                                These terms restate duties that already exist in RA 9262, RA 10173 and JMC 2010-2.
                                Have the barangay's data protection officer or your adviser review the wording before
                                this is adopted as policy.
                            </p>
                        </div>
                    </div>
                </article>
            </div>
        </AdminLayout>
    );
}

const FF = "'Lexend', sans-serif";
// Alignment at a 14.5px base: the section title line box is about 21px, so the
// 22px number badge sits level with its first line; the body indent of 32px is
// badge 22px + gap 10px, so list text starts under the title text; the bullet
// dot's 9px top offset centres it on a 24.6px first line.
const S = {
    // A reading column, centred in the content area rather than pinned left,
    // so wide monitors do not leave all the empty space on one side.
    column:       { width: '100%', maxWidth: 780, marginLeft: 'auto', marginRight: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 },

    heading:      { padding: '2px 2px 0' },
    kicker:       { margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AD530F', fontFamily: FF },
    h:            { margin: '6px 0 0', fontSize: 24, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15, color: COLORS.textPrimary, fontFamily: FF, textWrap: 'balance' },
    sub:          { margin: '6px 0 0', fontSize: 12.5, color: COLORS.textMuted, fontFamily: FF },

    toc:          { background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, padding: '12px 12px 8px' },
    tocLabel:     { margin: '0 0 4px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: COLORS.textMuted, fontFamily: FF },
    tocList:      { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0 10px' },
    tocLink:      { display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, padding: '4px 8px', borderRadius: RADIUS.md, color: COLORS.textSecondary, textDecoration: 'none', fontSize: 13, lineHeight: 1.35, fontFamily: FF },
    tocNum:       { width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: COLORS.primaryBg, color: '#AD530F', fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },

    card:         { position: 'relative', overflow: 'hidden', background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, boxShadow: 'var(--adm-card-shadow)' },
    accent:       { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: COLORS.primary },
    body:         { padding: '28px 30px 26px', fontSize: 14.5, lineHeight: 1.7, color: COLORS.textSecondary, fontFamily: FF, textAlign: 'left' },
    intro:        { margin: '0 0 26px', maxWidth: '70ch', fontSize: 15, lineHeight: 1.72, color: COLORS.textSecondary },

    section:      { marginTop: 24, paddingTop: 24, borderTop: `1px solid ${COLORS.border}`, scrollMarginTop: 80 },
    sectionFirst: { marginTop: 0, paddingTop: 0, borderTop: 'none' },
    sectionHead:  { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
    num:          { width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: COLORS.primaryBg, color: '#AD530F', fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FF },
    sectionTitle: { margin: 0, fontSize: 15.5, lineHeight: 1.35, fontWeight: 700, letterSpacing: '-0.01em', color: COLORS.textPrimary, fontFamily: FF, textWrap: 'balance' },
    list:         { listStyle: 'none', margin: 0, padding: '0 0 0 32px', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 'calc(72ch + 32px)' },
    item:         { display: 'flex', alignItems: 'flex-start', gap: 11 },
    dot:          { width: 6, height: 6, borderRadius: '50%', background: COLORS.primary, flexShrink: 0, marginTop: 9 },
    itemText:     { flex: 1, minWidth: 0 },

    review:       { marginTop: 28, background: COLORS.bgMuted, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.secondary}`, borderRadius: RADIUS.sm, padding: '14px 16px' },
    reviewTitle:  { margin: '0 0 4px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: COLORS.textMuted, fontFamily: FF },
    reviewText:   { margin: 0, fontSize: 13, lineHeight: 1.65, color: COLORS.textSecondary, maxWidth: '72ch', fontFamily: FF },
};
