import React from 'react';

/**
 * The Data Privacy Notice body, in one place.
 *
 * Rendered both by TermsModal (the blocking consent step before account
 * creation) and by the /terms page (so it can be re-read at any time, which
 * RA 10173 entitles the data subject to). Keeping one copy matters: two
 * versions of a consent notice that drift apart is a real problem, not a
 * tidiness one.
 *
 * `showAcknowledgment` is on for the modal, where the reader is about to
 * consent, and off for the page, where they are only reading.
 */

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

export default function TermsContent({ showAcknowledgment = false }) {
    return (
        <>
            <p style={S.intro}>
                Welcome to <strong style={S.strong}>VAWC-Response</strong>, the official reporting system of
                Barangay Palanginan, Iba, Zambales for cases of Violence Against Women and Children
                under <strong style={S.strong}>Republic Act 9262</strong>. Please read this notice carefully.
            </p>

            <Section num="1" title="What information we collect">
                <p style={S.para}>To process your reports and protect you, we collect:</p>
                <ul style={S.list}>
                    <Bullet><strong>Identity and contact</strong> - name, email, phone number, birthdate, sex, address.</Bullet>
                    <Bullet><strong>Account credentials</strong> - encrypted password (never stored in plain text).</Bullet>
                    <Bullet><strong>Minor or guardian details</strong> - only if you indicate you are a minor.</Bullet>
                    <Bullet><strong>Case data</strong> - incident statement, photos, GPS or pinned location, respondent name, type of abuse, relationship to the respondent, and incident date.</Bullet>
                </ul>
            </Section>

            <Section num="2" title="Why we collect it (purpose)">
                <p style={S.para}>Your data is used solely for:</p>
                <ul style={S.list}>
                    <Bullet>Receiving, recording, and acting on your VAWC report.</Bullet>
                    <Bullet>Applying for and recording a Barangay Protection Order, and monitoring it.</Bullet>
                    <Bullet>Endorsing cases to the PNP Women and Children Protection Desk, the C/MSWDO, the PAO, or the court when escalation is necessary.</Bullet>
                    <Bullet>Sending you status notifications about your case by email.</Bullet>
                </ul>
                <p style={S.para}>
                    The barangay does <strong style={S.strong}>not</strong> mediate, conciliate, or settle VAWC cases.
                    Republic Act 9262 and Joint Memorandum Circular 2010-2 prohibit this. The system records
                    and monitors your case; it does not decide it.
                </p>
                <p style={S.para}>We will <strong style={S.strong}>never</strong> sell, rent, or use your data for marketing.</p>
            </Section>

            <Section num="3" title="Who can access your data">
                <ul style={S.list}>
                    <Bullet>Authorized barangay personnel handling your case.</Bullet>
                    <Bullet>The Punong Barangay and designated VAWC Desk officers.</Bullet>
                    <Bullet>Endorsed authorities (PNP-WCPD, C/MSWDO, PAO, the court) only when your case is officially referred.</Bullet>
                    <Bullet>You, at any time, through your account.</Bullet>
                </ul>
                <p style={S.para}>
                    Sensitive fields - your statement, location, and the respondent's name - are
                    <strong style={S.strong}> encrypted at rest</strong> using Fernet symmetric encryption. Regular admins see
                    only masked previews; full content is visible only to authorized super admins.
                </p>
            </Section>

            <Section num="4" title="How long we keep your data">
                <ul style={S.list}>
                    <Bullet><strong>Active cases</strong> - retained while the barangay is still assisting you.</Bullet>
                    <Bullet><strong>Cases where assistance has ended</strong> - kept as official records consistent with National Privacy Commission and barangay records-management guidelines. Ending barangay assistance does not close or dismiss your case; only a court can do that.</Bullet>
                    <Bullet><strong>Deleted accounts</strong> - soft-deleted records can be recovered within 30 days, after which they are permanently removed.</Bullet>
                </ul>
            </Section>

            <Section num="5" title="Your rights under RA 10173">
                <p style={S.para}>As the data subject, you have the right to:</p>
                <ul style={S.list}>
                    <Bullet><strong>Be informed</strong> of how your data is processed.</Bullet>
                    <Bullet><strong>Access</strong> your personal data and the case records linked to it.</Bullet>
                    <Bullet><strong>Object</strong> to processing or withdraw consent, subject to existing legal obligations.</Bullet>
                    <Bullet><strong>Rectify</strong> inaccurate information through your profile or by contacting the barangay.</Bullet>
                    <Bullet><strong>Erasure or blocking</strong> of your data when there is no longer a legitimate purpose.</Bullet>
                    <Bullet><strong>Data portability</strong> - request a copy of your records.</Bullet>
                    <Bullet><strong>File a complaint</strong> with the National Privacy Commission (privacy.gov.ph).</Bullet>
                    <Bullet><strong>Be indemnified</strong> for damages caused by inaccurate, false, or unlawfully processed data.</Bullet>
                </ul>
            </Section>

            <Section num="6" title="Security and confidentiality">
                <p style={S.para}>
                    VAWC-Response uses field-level encryption, password hashing, encrypted login sessions, and
                    access controls to keep your information safe. Reports are treated with the strictest
                    confidentiality. Knowingly accessing, sharing, or tampering with these records is a
                    criminal offense under RA 10173, and disclosing your identity or the circumstances of your
                    case is punishable under Section 44 of RA 9262.
                </p>
            </Section>

            <Section num="7" title="Contact for privacy concerns">
                <p style={S.para}>
                    For questions, requests, or complaints regarding your personal data, contact the
                    Barangay Palanginan Data Privacy Officer through the barangay hall, or call the numbers
                    listed under <strong style={S.strong}>Hotlines</strong> on the home screen.
                </p>
            </Section>

            {showAcknowledgment && (
                <div style={S.acknowledge}>
                    <p style={S.ackTitle}>Acknowledgment</p>
                    <p style={S.ackText}>
                        By tapping <strong style={S.strong}>I Agree</strong>, you confirm that you have read and understood this Data
                        Privacy Notice, and you give your free and informed consent for VAWC-Response and
                        Barangay Palanginan to collect and process your personal information for the purposes
                        described above, in accordance with Republic Act 10173.
                    </p>
                </div>
            )}
        </>
    );
}

const FF = "'Lexend', sans-serif";
const S = {
    intro:       { margin: '0 0 18px', fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.7, fontFamily: FF },
    strong:      { color: 'var(--accent-text)', fontWeight: 700 },
    section:     { marginBottom: 18 },
    sectionHead: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 },
    sectionNum:  {
        width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: 'var(--surface-tint)',
        color: 'var(--accent-text)', fontSize: 11.5, fontWeight: 800,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FF,
    },
    sectionTitle:{ margin: 0, fontSize: 14.5, fontWeight: 800, color: 'var(--text)', fontFamily: FF },
    sectionBody: { paddingLeft: 31 },
    para:        { margin: '0 0 8px', fontSize: 13, color: 'var(--text-body)', lineHeight: 1.65, fontFamily: FF },
    list:        { listStyle: 'none', margin: '0 0 8px', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
    bullet:      { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-body)', lineHeight: 1.55, fontFamily: FF },
    bulletDot:   { width: 5, height: 5, borderRadius: '50%', background: '#F47920', flexShrink: 0, marginTop: 7 },
    acknowledge: { background: 'var(--bg-warn)', border: '1px solid var(--bd-warn)', borderRadius: 10, padding: '13px 15px', marginTop: 4 },
    ackTitle:    { margin: '0 0 4px', fontSize: 12, fontWeight: 800, color: 'var(--tx-warn)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: FF },
    ackText:     { margin: 0, fontSize: 12.5, color: 'var(--tx-warn)', lineHeight: 1.6, fontFamily: FF },
};
