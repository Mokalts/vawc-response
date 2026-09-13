import React from 'react';

/**
 * The Data Privacy Notice body, in one place.
 *
 * Rendered by TermsModal (the consent step before account creation) and by the
 * /terms page (so it can be re-read at any time, which RA 10173 entitles the
 * data subject to). One copy on purpose: two versions of a consent notice that
 * drift apart is how an unlawful "mediation" line once survived a rewrite.
 *
 * Every size is in `em`, set from one base font size on the root, so the same
 * styles read comfortably on the page (15px) and in the narrower modal (13.5px).
 */

export const TERMS_SECTIONS = [
    { id: 'terms-collect',   title: 'What information we collect' },
    { id: 'terms-purpose',   title: 'Why we collect it' },
    { id: 'terms-access',    title: 'Who can access your data' },
    { id: 'terms-retention', title: 'How long we keep your data' },
    { id: 'terms-rights',    title: 'Your rights under RA 10173' },
    { id: 'terms-security',  title: 'Security and confidentiality' },
    { id: 'terms-contact',   title: 'Contact for privacy concerns' },
];

const Section = ({ index, children }) => {
    const s = TERMS_SECTIONS[index];
    return (
        <section id={s.id} style={{ ...S.section, ...(index === 0 ? S.sectionFirst : null) }}>
            <div style={S.sectionHead}>
                <span style={S.num} aria-hidden="true">{index + 1}</span>
                <h3 style={S.sectionTitle}>{s.title}</h3>
            </div>
            <div style={S.sectionBody}>{children}</div>
        </section>
    );
};

// The text is wrapped in ONE span. The list item is a flex row, and without
// this wrapper a leading <strong> and the text after it became two separate
// flex items, so the label sat in its own column and the description wrapped
// beside it in a second, misaligned column.
const Item = ({ label, children }) => (
    <li style={S.item}>
        <span style={S.dot} aria-hidden="true" />
        <span style={S.itemText}>
            {label && <strong style={S.strong}>{label}: </strong>}
            {children}
        </span>
    </li>
);
const B = ({ children }) => <strong style={S.strong}>{children}</strong>;

export default function TermsContent({ showAcknowledgment = false, variant = 'page' }) {
    const isPage = variant === 'page';
    return (
        <div style={{ ...S.root, fontSize: isPage ? 15 : 13.5, maxWidth: isPage ? '72ch' : 'none' }}>
            <p style={S.intro}>
                Welcome to <B>VAWC-Response</B>, the official reporting system of Barangay Palanginan,
                Iba, Zambales for cases of Violence Against Women and Children under <B>Republic Act 9262</B>.
                Please read this notice carefully.
            </p>

            <Section index={0}>
                <p style={S.para}>To process your reports and protect you, we collect:</p>
                <ul style={S.list}>
                    <Item label="Identity and contact">name, email, phone number, birthdate, sex, and address.</Item>
                    <Item label="Account credentials">your password, stored only in encrypted form and never as plain text.</Item>
                    <Item label="Minor or guardian details">collected only if you indicate you are a minor.</Item>
                    <Item label="Case data">your statement, photos, GPS or pinned location, the respondent's name, the type of abuse, your relationship to the respondent, and the incident date.</Item>
                </ul>
            </Section>

            <Section index={1}>
                <p style={S.para}>Your data is used only to:</p>
                <ul style={S.list}>
                    <Item>Receive, record, and act on your VAWC report.</Item>
                    <Item>Apply for and record a Barangay Protection Order, and monitor it.</Item>
                    <Item>Endorse your case to the PNP Women and Children Protection Desk, the C/MSWDO, the PAO, or the court when escalation is necessary.</Item>
                    <Item>Send you status notifications about your case by email.</Item>
                </ul>
                <p style={S.note}>
                    The barangay does <B>not</B> mediate, conciliate, or settle VAWC cases. Republic Act 9262
                    and Joint Memorandum Circular 2010-2 prohibit it. The system records and monitors your
                    case; it does not decide it.
                </p>
                <p style={S.para}>We <B>never</B> sell, rent, or use your data for marketing.</p>
            </Section>

            <Section index={2}>
                <ul style={S.list}>
                    <Item>Authorized barangay personnel handling your case.</Item>
                    <Item>The Punong Barangay and designated VAWC Desk officers.</Item>
                    <Item>Authorities your case is endorsed to (PNP-WCPD, C/MSWDO, PAO, or the court), only when it is formally referred.</Item>
                    <Item>You, at any time, through your account.</Item>
                </ul>
                <p style={S.para}>
                    Your statement, your location, and the respondent's name are <B>encrypted at rest</B> using
                    Fernet symmetric encryption. Regular admins see only masked previews; the full content is
                    visible only to authorized super admins.
                </p>
            </Section>

            <Section index={3}>
                <ul style={S.list}>
                    <Item label="Active cases">kept while the barangay is still assisting you.</Item>
                    <Item label="Cases where assistance has ended">kept as official records under National Privacy Commission and barangay records-management guidelines. Ending barangay assistance does not close or dismiss your case; only a court can.</Item>
                    <Item label="Deleted accounts">can be recovered within 30 days, then permanently removed.</Item>
                </ul>
            </Section>

            <Section index={4}>
                <p style={S.para}>As the data subject, you have the right to:</p>
                <ul style={S.list}>
                    <Item><B>Be informed</B> of how your data is processed.</Item>
                    <Item><B>Access</B> your personal data and the case records linked to it.</Item>
                    <Item><B>Object</B> to processing, or withdraw consent, subject to existing legal obligations.</Item>
                    <Item><B>Rectify</B> inaccurate information through your profile or by contacting the barangay.</Item>
                    <Item><B>Have your data erased or blocked</B> when there is no longer a legitimate purpose.</Item>
                    <Item><B>Get a copy</B> of your records (data portability).</Item>
                    <Item><B>File a complaint</B> with the National Privacy Commission at privacy.gov.ph.</Item>
                    <Item><B>Be indemnified</B> for damages caused by inaccurate, false, or unlawfully processed data.</Item>
                </ul>
            </Section>

            <Section index={5}>
                <p style={S.para}>
                    VAWC-Response uses field-level encryption, password hashing, encrypted login sessions, and
                    access controls to keep your information safe. Reports are treated with the strictest
                    confidentiality.
                </p>
                <p style={S.para}>
                    Knowingly accessing, sharing, or tampering with these records is a criminal offense under
                    RA 10173, and disclosing your identity or the circumstances of your case is punishable under
                    Section 44 of RA 9262.
                </p>
            </Section>

            <Section index={6}>
                <p style={S.para}>
                    For questions, requests, or complaints about your personal data, contact the Barangay
                    Palanginan Data Privacy Officer at the barangay hall, or call the numbers listed
                    under <B>Hotlines</B> on the home screen.
                </p>
            </Section>

            {showAcknowledgment && (
                <div style={S.ack}>
                    <p style={S.ackTitle}>Acknowledgment</p>
                    <p style={S.ackText}>
                        By tapping <B>I Agree</B>, you confirm that you have read and understood this Data Privacy
                        Notice, and you give your free and informed consent for VAWC-Response and Barangay
                        Palanginan to collect and process your personal information for the purposes described
                        above, in accordance with Republic Act 10173.
                    </p>
                </div>
            )}
        </div>
    );
}

const FF = "'Lexend', sans-serif";
// Alignment arithmetic, all in em of the root size:
//   title line box = 1.1em x 1.35 = 1.485em, and the number badge matches it,
//   so a title that wraps to two lines keeps its badge on the first line;
//   body indent = badge 1.488em + gap 0.7em = 2.19em, so body text starts on
//   the same vertical as the title text;
//   bullet dot sits at (line-height 1.7em - dot 0.36em) / 2 = 0.67em, centring
//   it on the first line of its item at any base size.
const S = {
    root:         { fontFamily: FF, lineHeight: 1.7, color: 'var(--text-body)', textAlign: 'left' },
    intro:        { margin: '0 0 1.7em', fontSize: '1.03em', lineHeight: 1.72 },
    section:      { marginTop: '1.6em', paddingTop: '1.6em', borderTop: '1px solid var(--border-soft)', scrollMarginTop: 84 },
    sectionFirst: { marginTop: 0, paddingTop: 0, borderTop: 'none' },
    sectionHead:  { display: 'flex', alignItems: 'flex-start', gap: '0.7em', marginBottom: '0.8em' },
    num: {
        width: '1.86em', height: '1.86em', fontSize: '0.8em', flexShrink: 0, borderRadius: '0.5em',
        background: 'var(--surface-tint)', color: 'var(--accent-text)', fontWeight: 800,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: FF,
    },
    sectionTitle: { margin: 0, fontSize: '1.1em', lineHeight: 1.35, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text)', fontFamily: FF, textWrap: 'balance' },
    sectionBody:  { paddingLeft: '2.19em' },
    para:         { margin: '0 0 0.8em' },
    list:         { listStyle: 'none', margin: '0 0 0.9em', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6em' },
    item:         { display: 'flex', alignItems: 'flex-start', gap: '0.7em' },
    dot:          { width: '0.36em', height: '0.36em', borderRadius: '50%', background: 'var(--accent-text)', flexShrink: 0, marginTop: '0.67em' },
    itemText:     { flex: 1, minWidth: 0 },
    // Emphasis in the text colour, not orange: bold orange on every line made
    // the notice look like a list of warnings and slowed reading.
    strong:       { color: 'var(--text)', fontWeight: 600 },
    note: {
        margin: '0.2em 0 0.9em', padding: '0.75em 1em', borderRadius: '0.6em',
        background: 'var(--surface-alt)', borderLeft: '3px solid var(--accent-text)',
    },
    ack:          { marginTop: '1.8em', padding: '1em 1.1em', borderRadius: '0.75em', background: 'var(--bg-warn)', border: '1px solid var(--bd-warn)' },
    ackTitle:     { margin: '0 0 0.35em', fontSize: '0.8em', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx-warn)', fontFamily: FF },
    ackText:      { margin: 0, fontSize: '0.95em', lineHeight: 1.65, color: 'var(--tx-warn)' },
};
