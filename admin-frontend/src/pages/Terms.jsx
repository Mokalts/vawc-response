import React from 'react';
import { AdminLayout } from '../components/Sidebar';
import { COLORS, RADIUS } from '../theme';

/**
 * Terms of Use and Data Handling for barangay staff.
 *
 * Deliberately NOT the same document as the victim-facing privacy notice. That
 * one tells a data subject what happens to her information; this one tells an
 * officer what they are obliged to do with it. Same laws, opposite side of the
 * relationship.
 *
 * The obligations below restate duties that already exist in RA 9262, RA 10173
 * and JMC 2010-2; the system does not create them. Have the adviser or the
 * barangay's data protection officer review the wording before the defense.
 */

const Section = ({ num, title, children }) => (
    <section style={S.section}>
        <div style={S.sectionHead}>
            <span style={S.num}>{num}</span>
            <h2 style={S.sectionTitle}>{title}</h2>
        </div>
        <div style={S.sectionBody}>{children}</div>
    </section>
);
const Bullet = ({ children }) => (
    <li style={S.bullet}><span style={S.dot} />{children}</li>
);

export default function Terms() {
    return (
        <AdminLayout title="Terms & Data Handling" breadcrumbs={['Terms & Data Handling']}>
            <div style={S.wrap}>
                <div style={S.card}>
                    <div style={S.accent} aria-hidden="true" />
                    <div style={S.head}>
                        <p style={S.headTitle}>Terms of Use and Data Handling</p>
                        <p style={S.headSub}>
                            For authorized personnel of the Barangay Palanginan VAW Desk
                        </p>
                    </div>

                    <div style={S.body}>
                        <p style={S.intro}>
                            This portal holds the personal and case data of women and children who have
                            reported violence. Access is a duty, not a convenience. By signing in you
                            accept the obligations below.
                        </p>

                        <Section num="1" title="Authorized access only">
                            <ul style={S.list}>
                                <Bullet>Your account is personal. Do not share credentials, and do not let another person act under your account.</Bullet>
                                <Bullet>Open a case record only when you have a duty to act on it. Browsing records out of curiosity is a breach, even without disclosure.</Bullet>
                                <Bullet>Face verification is a second factor, not a formality. Do not bypass or delegate it.</Bullet>
                            </ul>
                        </Section>

                        <Section num="2" title="Confidentiality">
                            <ul style={S.list}>
                                <Bullet>Section 44 of RA 9262 makes it punishable to disclose the identity of a victim or the circumstances of her case. This covers conversation, messaging apps, and photographs of your screen.</Bullet>
                                <Bullet>Printed forms, BPO applications, and endorsement letters are confidential documents. Do not leave them on a desk or in a shared printer tray.</Bullet>
                                <Bullet>Discuss a case only with personnel who have a role in it, and only where you cannot be overheard.</Bullet>
                            </ul>
                        </Section>

                        <Section num="3" title="The barangay records, it does not adjudicate">
                            <ul style={S.list}>
                                <Bullet>RA 9262 and Joint Memorandum Circular 2010-2 prohibit mediation, conciliation, arbitration, and amicable settlement of VAWC cases at the barangay level.</Bullet>
                                <Bullet>Do not summon the respondent for a settlement meeting, and do not issue a Certificate to File Action for a VAWC case.</Bullet>
                                <Bullet>Ending barangay assistance is not closing or dismissing a case. Only a court can do that. Record a reason; never record an outcome as "resolved" or "settled".</Bullet>
                            </ul>
                        </Section>

                        <Section num="4" title="Accuracy of records">
                            <ul style={S.list}>
                                <Bullet>What you enter becomes part of an official record and may be printed on a Barangay Protection Order or an endorsement letter. Correct a misspelled name rather than leaving it.</Bullet>
                                <Bullet>Classify an incident from the complainant's statement. If the statement does not support a classification, ask her; do not guess.</Bullet>
                                <Bullet>Record the date and time of mandatory reporting to the PNP and the C/MSWDO accurately. JMC 2010-2 sets a four-hour expectation, and a falsified timestamp is worse than a late one.</Bullet>
                            </ul>
                        </Section>

                        <Section num="5" title="Data protection under RA 10173">
                            <ul style={S.list}>
                                <Bullet>Statements, locations, respondent names, and minors' details are encrypted at rest. Do not copy them into spreadsheets, personal email, or messaging apps.</Bullet>
                                <Bullet>Regular admins see masked previews. If you can see a full record, you are accountable for it.</Bullet>
                                <Bullet>Export or print only what a specific task requires, and dispose of printed copies securely.</Bullet>
                                <Bullet>Report a suspected breach to the Punong Barangay and the barangay's data protection officer immediately.</Bullet>
                            </ul>
                        </Section>

                        <Section num="6" title="Accountability">
                            <ul style={S.list}>
                                <Bullet>Actions in this portal are attributed to your account, including status changes, messages to the complainant, and deletions.</Bullet>
                                <Bullet>Misuse may carry administrative liability, and criminal liability under RA 9262 or RA 10173.</Bullet>
                                <Bullet>A barangay official who initiates mediation or reconciliation in a VAWC case is administratively liable. This is stated in the Barangay VAW Desk Handbook.</Bullet>
                            </ul>
                        </Section>

                        <div style={S.note}>
                            <p style={S.noteTitle}>Review before adoption</p>
                            <p style={S.noteText}>
                                These terms restate duties that already exist in RA 9262, RA 10173 and
                                JMC 2010-2. Have the barangay's data protection officer or your adviser
                                review the wording before this is adopted as policy.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

const FF = "'Lexend', sans-serif";
const S = {
    wrap:        { maxWidth: 820, width: '100%' },
    card:        { position: 'relative', overflow: 'hidden', background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.lg, boxShadow: 'var(--adm-card-shadow)' },
    accent:      { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: COLORS.primary },
    head:        { padding: '20px 22px 16px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgMuted },
    headTitle:   { margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-0.3px', color: COLORS.textPrimary, fontFamily: FF },
    headSub:     { margin: '3px 0 0', fontSize: 12.5, color: COLORS.textMuted, fontFamily: FF },
    body:        { padding: '20px 22px 22px' },
    intro:       { margin: '0 0 20px', fontSize: 13.5, lineHeight: 1.7, color: COLORS.textSecondary, fontFamily: FF, maxWidth: '64ch' },
    section:     { marginBottom: 20 },
    sectionHead: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 },
    num:         { width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: COLORS.primaryBg, color: '#AD530F', fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FF },
    sectionTitle:{ margin: 0, fontSize: 14.5, fontWeight: 800, color: COLORS.textPrimary, fontFamily: FF },
    sectionBody: { paddingLeft: 31 },
    list:        { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 },
    bullet:      { display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, lineHeight: 1.6, color: COLORS.textSecondary, fontFamily: FF, maxWidth: '66ch' },
    dot:         { width: 5, height: 5, borderRadius: '50%', background: COLORS.primary, flexShrink: 0, marginTop: 8 },
    note:        { marginTop: 4, background: COLORS.bgMuted, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.secondary}`, borderRadius: RADIUS.sm, padding: '13px 15px' },
    noteTitle:   { margin: '0 0 3px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: COLORS.textMuted, fontFamily: FF },
    noteText:    { margin: 0, fontSize: 12.5, lineHeight: 1.6, color: COLORS.textSecondary, fontFamily: FF },
};
