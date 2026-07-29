import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id = 'vawc-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-awareness-css')) {
    const s = document.createElement('style'); s.id = 'vawc-awareness-css';
    s.textContent = `
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .va-tab { transition: all 0.18s ease; }
        .va-tab:hover { opacity: 0.85; }
        .va-cta-btn { transition: all 0.15s ease; }
        .va-cta-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; }
        .va-back { transition: transform 0.12s ease; }
        .va-back:hover { transform: translateX(-2px); }
        .va-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .va-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.08) !important; }
        .tabs-scroll::-webkit-scrollbar { height: 6px; }
        .tabs-scroll::-webkit-scrollbar-track { background: #FFF3E0; border-radius: 9999px; }
        .tabs-scroll::-webkit-scrollbar-thumb { background: #FFCC99; border-radius: 9999px; }
        .tabs-scroll::-webkit-scrollbar-thumb:hover { background: #F47920; }
        .va-nav-btn { transition: all 0.15s ease; }
        .va-nav-btn:hover { background: #FFF3E0 !important; }

        /* Hero responsive layout */
        .va-hero {
            display: flex;
            flex-direction: row;
            gap: 16px;
            align-items: flex-start;
            border-radius: 4px;
            padding: 20px;
        }
        .va-hero-text {
            flex: 1 1 0;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .va-hero-img {
            flex: 0 0 280px;
            width: 280px;
        }
        .va-hero-img img {
            width: 100%;
            height: auto;
            aspect-ratio: 16/9;
            object-fit: cover;
            object-position: center;
            border-radius: 4px;
            display: block;
        }

        /* Mobile: image on top, text below, no side-by-side */
        @media (max-width: 600px) {
            .va-hero {
                flex-direction: column-reverse;
            }
            .va-hero-img {
                flex: none;
                width: 100%;
            }
            .va-hero-img img {
                width: 100%;
                height: 180px;
            }
        }
    `;
    document.head.appendChild(s);
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IcoBack   = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#C45E10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoArrow  = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12H19M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoFlag   = ({ c='#F47920' }) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="4" y1="22" x2="4" y2="15" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoDot    = ({ c='#F47920' }) => (<span style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c, display: 'inline-block', flexShrink: 0, marginTop: 6 }} />);

// ─── Section definitions ──────────────────────────────────────────────────────
const SECTIONS = [
    { id: 'signs',    label: 'Is it Abuse?' },
    { id: 'todo',     label: 'What to Do' },
    { id: 'where',    label: 'Where to Go' },
    { id: 'orders',   label: 'Protection Orders' },
    { id: 'rights',   label: 'Your Rights' },
    { id: 'laws',     label: 'Related Laws' },
    { id: 'penalties',label: 'Penalties' },
];

// ─── Full content ─────────────────────────────────────────────────────────────
const CONTENT = {
    signs: {
        title: 'Recognizing Abuse under RA 9262',
        law: 'Republic Act 9262',
        color: '#F47920',
        bg: '#FFF3E0',
        border: '#FFE4CC',
        // Place image at: victim-frontend/public/images/awareness/hero-signs.jpg
        // Suggested: landscape photo of a woman looking distressed or a hand against glass
        image: '/images/awareness/hero-signs.jpg',
        imageAlt: 'Recognizing signs of abuse',
        intro: 'According to Section 3(a) of Republic Act No. 9262 (the "Anti-Violence Against Women and Their Children Act of 2004"), violence against women and their children "refers to any act or a series of acts committed by any person against a woman who is his wife, former wife, or against a woman with whom the person has or had a sexual or dating relationship, or with whom he has a common child... which result in or is likely to result in physical, sexual, psychological harm or suffering, or economic abuse." Section 5 of the law then enumerates the specific acts that constitute this violence.',
        items: [
            { heading: 'Physical Violence', text: 'Any act that causes or attempts to cause physical harm. This includes hitting, slapping, kicking, punching, choking, burning, stabbing, throwing objects at the victim, or using any object or weapon to inflict injury. It also includes restraining or confining the victim against her will.' },
            { heading: 'Sexual Violence', text: "Any act that is sexual in nature and committed against a woman or her child without consent. This includes rape, sexual assault, or forcing the victim to perform sexual acts, view pornographic material, or engage in any sexual activity regardless of the victim's marital status. Marital rape is recognized as a crime under RA 8353." },
            { heading: 'Psychological Violence', text: "Acts or omissions that cause mental or emotional suffering. This includes: intimidation and harassment; stalking; causing or allowing the victim to witness abuse of a child; repeated humiliation, name-calling, or degradation in public or in private; controlling or restricting the victim's movements, communications, or social activities; threats to harm the victim or her children; monitoring phone calls and messages." },
            { heading: 'Economic Abuse', text: "Controlling the woman's financial resources, making or attempting to make the woman financially dependent. Includes withholding financial support, destroying property, preventing the woman from engaging in legitimate employment or activity, controlling the money and making all financial decisions, and demanding all the income the victim earns." },
            { heading: 'Abuse Committed Through Technology', text: 'Under the Safe Spaces Act (RA 11313) and related laws, online or technology-facilitated abuse is also recognized. This includes sending threatening messages, posting private images without consent (covered by RA 9995 - Anti-Photo and Video Voyeurism Act), and using digital means to stalk, harass, or humiliate the victim.', highlight: true },
            { heading: 'Ask yourself - Am I experiencing abuse?', text: "• Does your partner hit, kick, slap, or threaten to hurt you?\n• Are you forced into sexual acts you do not want?\n• Are you constantly criticized, humiliated, or called names?\n• Is your partner controlling your money, phone, or movements?\n• Are you afraid of your partner's reactions?\n• Are you isolated from your family and friends?\nIf you answered yes to any of these, you may be experiencing abuse. You are not alone.", highlight: true },
        ],
    },
    todo: {
        title: 'What to Do When You Experience Abuse',
        law: 'Practical Safety Guide',
        color: '#C45E10',
        bg: '#FFF3E0',
        border: '#FFE4CC',
        // Place image at: victim-frontend/public/images/awareness/hero-todo.jpg
        // Suggested: landscape photo of woman writing at a desk or filling out a form
        image: '/images/awareness/hero-todo.jpg',
        imageAlt: 'Steps to take when experiencing abuse',
        intro: 'Your safety is the top priority. Here are the steps you can take, in order of urgency. Remember: what happened is not your fault.',
        items: [
            { heading: '1. Ensure Your Immediate Safety', text: 'If you are in immediate danger, leave the area as quickly and safely as possible. Go to a neighbor, a trusted relative, a hospital, or any public place. Call 911 if you or your children are in danger. Have a safety bag ready if possible - containing important documents, medications, money, and a change of clothes.' },
            { heading: '2. Seek Medical Attention Immediately', text: 'Go to the nearest government hospital or Rural Health Unit (RHU). Ask the attending physician to document your injuries in a Medico-Legal Certificate. This document is critical evidence in any legal case. Photographs of injuries should also be taken as soon as possible.' },
            { heading: '3. Document Everything', text: 'Write down what happened - dates, times, locations, and descriptions of each incident. Take photographs of injuries, destroyed property, and threatening messages. Save all text messages, emails, or screenshots. Store copies of all documents (IDs, medical records, financial documents) in a secure location your abuser cannot access.' },
            { heading: '4. Report to Your Barangay VAWC Desk', text: 'Every barangay is required by law to have a Violence Against Women and Children (VAWC) Desk. Barangay officials must respond within 24 hours of receiving a report. They can issue a Barangay Protection Order (BPO) on the same day you file. You may bring a trusted person for support.' },
            { heading: '5. Report to the PNP Women and Children Protection Desk (WCPD)', text: 'The WCPD handles VAWC cases at the police level. They are trained to handle these cases with sensitivity and confidentiality. They can assist you in filing a criminal complaint and conduct investigation. Available at all police stations nationwide.' },
            { heading: '6. Apply for a Protection Order', text: 'A Barangay Protection Order (BPO) can be issued by your barangay on the same day you report. A Temporary Protection Order (TPO) can be issued by a court within 24 hours of filing. A Permanent Protection Order (PPO) provides long-term legal protection. The offender can be required to stay away from you, your home, school, and workplace.', highlight: true },
            { heading: '7. File a Criminal Complaint', text: "You may file a criminal case at the Prosecutor's Office or the Regional Trial Court designated as a Family Court. Violations of RA 9262 carry significant penalties. You can seek assistance from the Public Attorney's Office (PAO) for free legal representation." },
            { heading: '8. Use VAWC-Response to Report', text: 'You can file a report directly through this app. Your report is confidential and will be reviewed by barangay officials. Include a statement describing the incident, photos if available, and your location.', highlight: true },
        ],
    },
    where: {
        title: 'Where to Seek Help',
        law: 'Government & Support Agencies',
        color: '#059669',
        bg: '#ECFDF5',
        border: '#A7F3D0',
        // Place image at: victim-frontend/public/images/awareness/hero-where.jpg
        // Suggested: landscape photo of a barangay hall, government building, or welcoming office
        image: '/images/awareness/hero-where.jpg',
        imageAlt: 'Government agencies that can help',
        intro: 'According to Section 30 of Republic Act No. 9262, barangay officials, together with law enforcers and social workers, have the duty to "respond immediately to a call for help or request for assistance" and to "ensure the enforcement of Protection Orders." Section 39 creates an Inter-Agency Council on Violence Against Women and their Children (IACVAWC) to coordinate these agencies. All are required by law to maintain confidentiality, and you may approach any of them - you do not need to go to them in any particular order.',
        items: [
            { heading: 'Barangay VAWC Desk', text: "Your first and most accessible point of contact. Every barangay in the Philippines is required by RA 9262 to have a VAWC desk staffed by a trained official. They can: issue a Barangay Protection Order on the same day; assist in filing a complaint; refer you to other agencies for shelter, legal aid, or counseling; coordinate with police for enforcement of protection orders." },
            { heading: 'PNP Women and Children Protection Desk (WCPD)', text: 'Located at every police station. WCPD officers are specifically trained to handle VAWC cases with sensitivity, privacy, and efficiency. They can: take your statement, document your injuries, and gather evidence; assist you in filing a criminal complaint; coordinate arrest if a protection order is violated; conduct follow-up investigation. Hotline: 1800-188-PNP-107.' },
            { heading: 'Department of Social Welfare and Development (DSWD)', text: 'Provides comprehensive support services including: temporary shelter at Lingap Centers and residential care facilities; psychosocial counseling and trauma-informed care; livelihood assistance and economic empowerment programs; referral to legal aid services; services for children affected by abuse. DSWD Action Center: 8-951-2803.' },
            { heading: 'Family Courts (Regional Trial Courts)', text: 'Designated Family Courts have exclusive jurisdiction over VAWC cases. They can: issue Temporary and Permanent Protection Orders within 24–72 hours; order the offender to leave the family home; grant temporary custody of children; order payment of support and other relief. You do not need a lawyer to petition for a protection order.' },
            { heading: "Public Attorney's Office (PAO)", text: "Provides free legal representation to VAWC victims who cannot afford a private lawyer. Services include: legal counseling and advice; representation in criminal cases; assistance in filing complaints; help in applying for protection orders. PAO offices are available at city and provincial halls nationwide. Hotline: (02) 8929-9436." },
            { heading: 'National Bureau of Investigation (NBI)', text: 'Can assist in cases involving violence, especially where evidence collection is needed. They conduct forensic investigation and assist in cases that require federal-level inquiry. NBI Hotline: 8523-8231.' },
            { heading: 'Commission on Human Rights (CHR)', text: "Monitors the government's compliance with human rights standards, including protection of VAWC victims. Can receive complaints against government officials who fail to provide assistance. CHR Hotline: (02) 294-8704.", highlight: true },
        ],
    },
    orders: {
        title: 'Protection Orders under RA 9262',
        law: 'Section 8–14, RA 9262',
        color: '#F47920',
        bg: '#FFF3E0',
        border: '#FFCC99',
        // Place image at: victim-frontend/public/images/awareness/hero-orders.jpg
        // Suggested: landscape photo of a legal document, gavel, or courthouse exterior
        image: '/images/awareness/hero-orders.jpg',
        imageAlt: 'Legal protection orders',
        intro: 'According to Section 8 of Republic Act No. 9262, a protection order is "an order issued... for the purpose of preventing further acts of violence against a woman or her child... and granting other necessary relief." Sections 14 to 16 provide for three types - the Barangay, Temporary, and Permanent Protection Orders - each issued by a different authority. Under Section 12, courts must act on a petition within 24 hours. Violation of any protection order is a criminal offense.',
        items: [
            { heading: 'Barangay Protection Order (BPO)', text: 'Issued by: Barangay Chairman or any barangay official.\nValidity: 15 days.\nProcessing time: Can be issued on the same day of application.\n\nWhat it covers:\n• Prohibits the offender from committing any act of violence\n• Orders the offender to stop harassing, intimidating, or threatening the victim\n• Can prohibit the offender from contacting the victim by phone, email, or any means\n\nHow to apply: Go to your barangay hall and file a request. No filing fee. No need for a lawyer.' },
            { heading: 'Temporary Protection Order (TPO)', text: "Issued by: Regional Trial Court (Family Court).\nValidity: 30 days, renewable.\nProcessing time: Issued within 24 hours of application.\n\nWhat it covers:\n• All provisions of a BPO, plus:\n• Removal of the offender from the family home\n• Temporary custody of children to the victim\n• Support for the victim and children\n• Prohibition from disposing of conjugal property\n\nHow to apply: File a petition at the nearest Family Court. No filing fee for indigent petitioners.", highlight: true },
            { heading: 'Permanent Protection Order (PPO)', text: 'Issued by: Regional Trial Court (Family Court) after notice and hearing.\nValidity: Permanent, until lifted by the court.\n\nWhat it covers:\n• All provisions of a TPO, made permanent\n• Permanent prohibition for the offender from approaching the victim\n• Continued child support and custody arrangements\n• Any other relief the court deems just\n\nNote: A PPO is issued after a full court hearing where both parties are given a chance to be heard.' },
            { heading: 'Violation of a Protection Order', text: 'Under Section 9 of RA 9262, any violation of a Barangay, Temporary, or Permanent Protection Order by the respondent shall be punishable by imprisonment of 30 days, without prejudice to any other criminal or civil action the offended party may file.\n\nPolice officers are authorized to arrest the respondent without a warrant if they have reasonable cause to believe the respondent has violated a protection order.' },
            { heading: "Children's Protection - RRPAO", text: 'In cases involving children, the court may also issue a Relief and Referral for Protective Measures for At-Risk Children (RRPAO) in coordination with the DSWD. This can include removal of the child from the abusive environment, temporary custody, and placement in a safe facility.', highlight: true },
        ],
    },
    rights: {
        title: 'Your Rights under RA 9262',
        law: 'Republic Act 9262 - Key Provisions',
        color: '#C45E10',
        bg: '#FFF3E0',
        border: '#FFCC99',
        // Place image at: victim-frontend/public/images/awareness/hero-rights.jpg
        // Suggested: landscape photo of a confident woman or women supporting each other
        image: '/images/awareness/hero-rights.jpg',
        imageAlt: 'Your rights as a VAWC victim',
        intro: 'According to Section 35 of Republic Act No. 9262, a victim is entitled to specific rights that all agencies must uphold - including the right "to be treated with respect and dignity," the right "to avail of legal assistance from the PAO," and the right "to be entitled to support services from the DSWD and LGUs." Section 34 further allows a victim who is a barangay official or employee to be granted leave. These rights exist regardless of your economic status, religion, nationality, or relationship with the offender.',
        items: [
            { heading: 'Right to Be Protected', text: 'You have the right to be protected from all forms of violence by law enforcement, barangay officials, and the courts. Government personnel who fail to provide protection or who deny assistance to VAWC victims may be held criminally and administratively liable under Section 33 of RA 9262.' },
            { heading: 'Right to Confidentiality', text: 'Your identity, the details of your case, and all information you share with government agencies must be kept strictly confidential. Unauthorized disclosure of your identity or the circumstances of your case is punishable under Section 44 of RA 9262 and may also be prosecuted under the Data Privacy Act (RA 10173).' },
            { heading: 'Right to Legal Assistance', text: "You are entitled to free legal assistance through the Public Attorney's Office (PAO) if you cannot afford a private lawyer. You have the right to be assisted by a lawyer or support person of your choice during all proceedings. No government office may deny you assistance because you do not have a lawyer." },
            { heading: 'Right to Support', text: 'Under the Family Code and RA 9262, you and your children are entitled to financial support from the offender even while a case is ongoing. The court can order the offender to provide support as part of a Temporary or Permanent Protection Order. Failure to provide court-ordered support may result in contempt of court.' },
            { heading: 'Right to Custody', text: "Courts will prioritize the safety and well-being of the child. A protection order can include provisions for temporary custody of your children to be granted to you. Under RA 9262, no child shall be placed in the custody of a person who has been found guilty of violence against the child's mother." },
            { heading: 'Right to Prompt Police Assistance', text: 'Police officers are required by law to respond to VAWC calls immediately. They may arrest the offender without a warrant if the act of violence is happening or has just happened. They must make a written report of every incident and refer the victim to the appropriate agency for further assistance.' },
            { heading: 'Right to Civil Remedies', text: 'In addition to criminal proceedings, you may file a civil action against the offender for damages including actual, compensatory, moral, and exemplary damages. You may also seek restitution for medical expenses, counseling fees, and any other costs directly resulting from the abuse.' },
            { heading: 'You Are Believed', text: "The law presumes that victims of VAWC are telling the truth. You do not need to prove that you were afraid or that you resisted. Violence between intimate partners is recognized as a pattern of control, not isolated incidents. Every act of violence - no matter how small - is taken seriously.", highlight: true },
        ],
    },
    laws: {
        title: 'Related Philippine Laws',
        law: 'Legal Framework',
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A',
        // Place image at: victim-frontend/public/images/awareness/hero-laws.jpg
        // Suggested: landscape photo of Philippine flag, law books, or a library
        image: '/images/awareness/hero-laws.jpg',
        imageAlt: 'Philippine laws protecting women and children',
        intro: 'Beyond RA 9262, several laws work together to protect women and children from violence and abuse. Understanding these laws can help you identify which applies to your situation.',
        items: [
            { heading: 'RA 9262 - Anti-VAWC Act of 2004', text: 'The primary law protecting women and their children from violence committed by their intimate partner, husband, or former partner. Covers physical, sexual, psychological, and economic abuse. Provides for protection orders, criminal penalties, and support services.' },
            { heading: 'RA 8353 - Anti-Rape Law of 1997', text: 'Expanded the definition of rape to include marital rape. A husband can be prosecuted for raping his wife. The law recognizes rape as a crime against a person, not just against chastity. Penalties range from reclusion perpetua to life imprisonment depending on circumstances.' },
            { heading: 'RA 7610 - Special Protection of Children Against Abuse, Exploitation and Discrimination Act', text: 'Provides stronger deterrence against child abuse, exploitation, and discrimination. Applies to children below 18 years old or those over 18 but unable to protect themselves. Any form of child abuse - physical, sexual, or psychological - is punishable under this law.' },
            { heading: 'RA 9995 - Anti-Photo and Video Voyeurism Act of 2009', text: 'Criminalizes the unauthorized recording and sharing of private acts, including intimate images. Specifically covers acts committed by former or current partners. The penalty is imprisonment of 3 to 7 years and a fine of up to ₱500,000. Also covers "revenge porn" situations.' },
            { heading: 'RA 11313 - Safe Spaces Act (Bawal Bastos Law) of 2019', text: 'Extends protections against gender-based harassment to public spaces, online spaces, workplaces, and educational institutions. Covers catcalling, wolf-whistling, persistent unwanted comments, online harassment, and cyberstalking. Employers and school administrators can be held liable if they fail to act on complaints.' },
            { heading: 'RA 9208 - Anti-Trafficking in Persons Act (as amended by RA 10364)', text: 'Protects women and children from trafficking, forced labor, and sexual exploitation. Defines trafficking broadly to include recruitment, transportation, and receipt of persons for exploitation. Penalties range from 6 years to life imprisonment. Provides special protections for victims including confidentiality and assistance.' },
            { heading: 'RA 10173 - Data Privacy Act of 2012', text: "Protects the personal information of VAWC victims from unauthorized disclosure. Government agencies handling VAWC cases must implement data protection measures. Unauthorized sharing of a victim's information is a criminal offense.", highlight: true },
            { heading: 'The Family Code of the Philippines', text: 'Governs marriage, separation, annulment, and child custody. Relevant to VAWC cases involving married couples or those with shared children. Allows legal separation on the grounds of physical violence or gross abuse. Courts may grant protective orders as part of family court proceedings.' },
        ],
    },
    penalties: {
        title: 'Penalties under RA 9262',
        law: 'Section 6, Republic Act 9262',
        color: '#DC2626',
        bg: '#FEF2F2',
        border: '#FECACA',
        // Place image at: victim-frontend/public/images/awareness/hero-penalties.jpg
        // Suggested: landscape photo of a gavel, justice scale, or courthouse
        image: '/images/awareness/hero-penalties.jpg',
        imageAlt: 'Penalties for violations of RA 9262',
        intro: 'According to Section 6 of Republic Act No. 9262, the acts of violence enumerated in Section 5 are punishable with penalties ranging from arresto mayor up to reclusion perpetua, depending on the gravity of the act. In addition to imprisonment, the offender "shall pay a fine in the amount of not less than One hundred thousand pesos (P100,000.00) but not more than three hundred thousand pesos (P300,000.00)," undergo mandatory psychological counseling, and report compliance to the court. These penalties apply to the offender - never to the victim.',
        items: [
            { heading: 'Acts Causing Death', text: 'The penalty is reclusion perpetua (life imprisonment) if the act of violence results in the death of the victim or any of her children. This is the most severe penalty under the law. The offender will also be required to pay civil damages to the heirs of the victim.' },
            { heading: 'Acts Causing Serious Physical Injury', text: 'Imprisonment of prision mayor in its maximum period (10 to 12 years) if the offense results in mutilation, loss of a limb, incapacity for work, or other serious physical injuries. Includes acts that result in permanent physical disability or disfigurement.' },
            { heading: 'Acts Causing Less Serious Physical Injury', text: 'Imprisonment of prision correccional in its maximum period (4 years, 2 months, and 1 day to 6 years). Applies to acts that cause injury requiring medical attention between 10 to 30 days, or that cause incapacity for labor for the same period.' },
            { heading: 'Acts Causing Slight Physical Injury', text: 'Imprisonment of arresto mayor (1 month to 6 months). Applies to acts that cause injury or incapacity for labor for 1 to 9 days, or acts that do not prevent the victim from engaging in habitual work.' },
            { heading: 'Psychological Violence', text: 'Imprisonment of prision correccional to prision mayor (6 months to 12 years). Mental or emotional anguish or suffering caused to the victim. Courts consider the nature, frequency, duration, and severity of the psychological acts when determining the specific penalty.' },
            { heading: 'Economic Abuse', text: 'Imprisonment of arresto mayor to prision correccional (1 month to 6 years). Includes withholding of financial support, destruction of property, and prevention of employment. The offender may also be ordered to pay restitution and provide financial support to the victim and children.' },
            { heading: 'Violation of a Protection Order', text: 'Imprisonment of 30 days for each violation, without prejudice to criminal prosecution for the underlying act. The offender can be arrested without a warrant for violating a protection order. Repeated violations will result in cumulative penalties.' },
            { heading: 'Additional Consequences', text: 'Beyond imprisonment, the court may impose: perpetual or temporary absolute disqualification from public office; loss of parental authority; payment of actual and moral damages; mandatory attendance in psychiatric or psychological programs; and other measures to rehabilitate the offender and protect the victim.', highlight: true },
        ],
    },
};

// ─── Card Component ───────────────────────────────────────────────────────────
function ContentCard({ item, color, bg, border }) {
    if (item.highlight) {
        return (
            <div className="va-card" style={{
                backgroundColor: bg,
                border: `1.5px solid ${border}`,
                borderRadius: 4,
                padding: '20px',
                animation: 'fadeUp 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: color, borderRadius: 4}} />
                <div style={{ paddingLeft: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                        <IcoFlag c={color} />
                        <p style={{ fontSize: 14, fontWeight: 700, color, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{item.heading}</p>
                    </div>
                    <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{item.text}</p>
                </div>
            </div>
        );
    }
    return (
        <div className="va-card" style={{
            backgroundColor: '#fff',
            borderRadius: 4,
            padding: '20px',
            border: '1px solid #F1F5F9',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            animation: 'fadeUp 0.3s ease',
        }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <IcoDot c={color} />
                <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color, margin: '0 0 8px', fontFamily: "'DM Sans', sans-serif" }}>{item.heading}</p>
                    <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.8, whiteSpace: 'pre-line', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{item.text}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function Awareness() {
    const navigate = useNavigate();
    const location = useLocation();
    const tabsRef  = useRef(null);

    const params = new URLSearchParams(location.search);
    const [activeSection, setActiveSection] = useState(params.get('section') || 'signs');

    useEffect(() => {
        const s = new URLSearchParams(location.search).get('section');
        if (s && CONTENT[s]) setActiveSection(s);
    }, [location.search]);

    const current    = CONTENT[activeSection];
    const currentIdx = SECTIONS.findIndex(s => s.id === activeSection);

    const handleTab = (id) => {
        setActiveSection(id);
        const el = document.getElementById(`va-tab-${id}`);
        if (el && tabsRef.current) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div style={S.page}>

            {/* Top bar */}
            <header style={S.topBar}>
                <button className="va-back" style={S.backBtn} onClick={() => navigate('/home')}>
                    <IcoBack />
                </button>
                <h1 style={S.title}>Awareness & Safety</h1>
                <div style={{ width: 36 }} />
            </header>

            {/* Tabs */}
            <div style={S.tabsWrapper}>
                <div style={{ position: 'relative' }}>
                    <div className="tabs-scroll" ref={tabsRef} style={S.tabs}>
                        {SECTIONS.map(sec => (
                            <button id={`va-tab-${sec.id}`} key={sec.id} className="va-tab"
                                style={{
                                    ...S.tab,
                                    backgroundColor: activeSection === sec.id ? CONTENT[sec.id].color : 'transparent',
                                    color: activeSection === sec.id ? '#fff' : '#C45E10',
                                    border: `1.5px solid ${activeSection === sec.id ? CONTENT[sec.id].color : '#FFE4CC'}`,
                                    fontWeight: activeSection === sec.id ? 700 : 500,
                                }}
                                onClick={() => handleTab(sec.id)}>
                                {sec.label}
                            </button>
                        ))}
                    </div>
                    <div style={S.tabsFadeRight} />
                </div>
            </div>

            {/* Content */}
            <main style={S.content}>

                {/* ── Hero: responsive image + text ── */}
                <div
                    className="va-hero"
                    style={{ backgroundColor: current.bg, border: `1.5px solid ${current.border}` }}
                >
                    {/* Text - left on PC, below image on mobile */}
                    <div className="va-hero-text">
                        <span style={{
                            display: 'inline-block',
                            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.7px',
                            textTransform: 'uppercase',
                            padding: '4px 10px', borderRadius: 4,
                            border: `1px solid ${current.color}30`,
                            backgroundColor: `${current.color}18`,
                            color: current.color,
                            width: 'fit-content',
                            fontFamily: "'DM Sans', sans-serif",
                        }}>
                            {current.law}
                        </span>
                        <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0, lineHeight: 1.25, color: current.color, fontFamily: "'DM Sans', sans-serif" }}>
                            {current.title}
                        </h2>
                        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.75, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                            {current.intro}
                        </p>
                    </div>

                    {/* Image - right on PC, top on mobile */}
                    <div className="va-hero-img">
                        <img
                            src={current.image}
                            alt={current.imageAlt}
                        />
                    </div>
                </div>

                {/* Progress bar */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {SECTIONS.map((sec, i) => (
                        <div key={sec.id}
                            onClick={() => handleTab(sec.id)}
                            style={{
                                flex: 1, height: 3, borderRadius: 4, cursor: 'pointer',
                                backgroundColor: i === currentIdx
                                    ? current.color
                                    : i < currentIdx
                                        ? `${current.color}50`
                                        : '#E2E8F0',
                                transition: 'background-color 0.2s ease',
                            }}
                        />
                    ))}
                </div>
                <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'right', margin: '-8px 0 0', fontFamily: "'DM Sans', sans-serif" }}>
                    {currentIdx + 1} of {SECTIONS.length}
                </p>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {current.items.map((item, i) => (
                        <div key={i} style={{ animationDelay: `${i * 0.04}s` }}>
                            <ContentCard item={item} color={current.color} bg={current.bg} border={current.border} />
                        </div>
                    ))}
                </div>

                {/* Navigation */}
                <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center' }}>
                    {currentIdx > 0 ? (
                        <button className="va-nav-btn" style={S.navBtn} onClick={() => handleTab(SECTIONS[currentIdx - 1].id)}>
                            ← {SECTIONS[currentIdx - 1].label}
                        </button>
                    ) : <div />}
                    {currentIdx < SECTIONS.length - 1 && (
                        <button className="va-nav-btn"
                            style={{ ...S.navBtn, color: current.color, borderColor: current.color, marginLeft: 'auto' }}
                            onClick={() => handleTab(SECTIONS[currentIdx + 1].id)}>
                            {SECTIONS[currentIdx + 1].label} →
                        </button>
                    )}
                </div>

                {/* CTA */}
                <div style={{ background: 'linear-gradient(135deg, #C45E10 0%, #F47920 100%)', borderRadius: 4, padding: '22px', marginTop: 8 }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 6px', fontFamily: "'DM Sans', sans-serif" }}>Ready to take action?</p>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, margin: '0 0 16px', fontFamily: "'DM Sans', sans-serif" }}>
                        File a report confidentially through VAWC-Response. Your report is encrypted and reviewed by barangay officials.
                    </p>
                    <button className="va-cta-btn"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', backgroundColor: '#fff', color: '#F47920', fontSize: 14, fontWeight: 700, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                        onClick={() => navigate('/report')}>
                        <span>Report Now</span>
                        <IcoArrow />
                    </button>
                </div>

            </main>
        </div>
    );
}

const S = {
    page:          { minHeight: '100vh', backgroundColor: '#FFF3E0', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" },
    topBar:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', backgroundColor: '#fff', borderBottom: '1px solid #FFE4CC', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 8px rgba(244,121,32,0.06)' },
    backBtn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF3E0', border: '1.5px solid #FFE4CC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    title:         { fontSize: 17, fontWeight: 700, color: '#C45E10', fontFamily: "'DM Sans', sans-serif" },
    tabsWrapper:   { backgroundColor: '#fff', borderBottom: '1px solid #FFE4CC', padding: '12px 16px', position: 'sticky', top: 65, zIndex: 99 },
    tabsFadeRight: { position: 'absolute', top: 0, right: 0, width: 48, height: '100%', background: 'linear-gradient(to right, transparent, #fff)', pointerEvents: 'none' },
    tabs:          { display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#FFCC99 #FFF3E0', WebkitOverflowScrolling: 'touch', paddingBottom: 8, paddingRight: 32 },
    tab:           { whiteSpace: 'nowrap', padding: '7px 15px', borderRadius: 4, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 },
    content:       { padding: '20px', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 40 },
    navBtn:        { padding: '10px 16px', borderRadius: 4, border: '1.5px solid #FFE4CC', backgroundColor: '#fff', color: '#C45E10', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
};

export default Awareness;
