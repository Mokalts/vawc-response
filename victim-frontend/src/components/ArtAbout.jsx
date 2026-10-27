import React from 'react';

/**
 * What the service is, in one picture: a report being sent from a phone,
 * under the shield that is the barangay holding it, with the three stages
 * of a case as a track beneath.
 *
 * Authored rather than taken from a stock set, so the home page and the
 * sign-in do not reuse the illustration style of the awareness pages. It
 * draws from the theme variables, so it follows light and dark on its own.
 *
 * Shared by Home and SignIn. It was written for the Home card; the sign-in
 * wanted the same picture, and a copy of twenty lines of SVG in two files is
 * two things to keep in step.
 */
const ArtAbout = (props) => (
    <svg viewBox="0 0 220 150" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        {/* phone */}
        <rect x="63" y="22" width="94" height="112" rx="10" fill="var(--surface)" stroke="var(--text)" strokeWidth="3" />
        <rect x="74" y="36" width="72" height="8" rx="4" fill="#FFD9B3" />
        <rect x="74" y="52" width="54" height="6" rx="3" fill="var(--border-soft)" />
        <rect x="74" y="64" width="62" height="6" rx="3" fill="var(--border-soft)" />
        <rect x="74" y="76" width="40" height="6" rx="3" fill="var(--border-soft)" />
        {/* the send action */}
        <rect x="74" y="96" width="72" height="22" rx="6" fill="#AD530F" />
        <path d="M100 107h20m0 0-5-5m5 5-5 5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {/* shield over the phone: the desk holding what she sent */}
        <path d="M156 14l24 9v22c0 15-10 27-24 32-14-5-24-17-24-32V23l24-9z" fill="#FFF3E0" stroke="#AD530F" strokeWidth="3" strokeLinejoin="round" />
        <path d="M147 44l7 7 14-14" stroke="#AD530F" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* the three stages, as a track */}
        <path d="M30 140h160" stroke="var(--border)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="40" cy="140" r="7" fill="#AD530F" />
        <circle cx="110" cy="140" r="7" fill="#AD530F" />
        <circle cx="180" cy="140" r="7" fill="var(--border)" stroke="#AD530F" strokeWidth="3" />
    </svg>
);

export default ArtAbout;
