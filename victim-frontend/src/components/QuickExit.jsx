import React, { useEffect, useRef } from 'react';

/**
 * QuickExit — a one-tap escape from the app.
 *
 * Standard safety control for VAWC / domestic-abuse services: if someone walks
 * in while she is reading or filing a report, she needs the screen gone in one
 * action, with nothing incriminating left behind.
 *
 * What it does, in order:
 *   1. Opens a neutral site in a NEW tab and focuses it, so the visible screen
 *      changes immediately.
 *   2. Replaces this tab's location, so VAWC-Response is gone from the back
 *      button. `location.replace` does not push a history entry, which matters
 *      more than the redirect itself — pressing Back must not return here.
 *   3. Clears the draft report from localStorage. A half-written statement is
 *      the single most dangerous thing to leave on a shared device.
 *
 * It deliberately does NOT sign her out: being logged in is not visible, and
 * forcing a re-login later adds friction at a moment she may not have time for.
 *
 * Shortcut: press Escape three times quickly. Three rather than one so it
 * cannot fire while she is simply closing a dialog.
 */

const EXIT_URL = 'https://www.google.com/search?q=weather+today';
const DRAFT_KEYS = ['vawc_report_draft', 'vawc_signup_draft'];

if (!document.getElementById('vawc-quickexit-css')) {
    const s = document.createElement('style'); s.id = 'vawc-quickexit-css';
    s.textContent = `
        .vqe-btn {
            position: fixed; right: 14px; z-index: 400;
            display: inline-flex; align-items: center; gap: 7px;
            min-height: 44px; padding: 0 14px;
            border: 1.5px solid var(--border); border-radius: 9999px;
            background: var(--surface); color: var(--text-body);
            font-family: 'Lexend', sans-serif; font-size: 12.5px; font-weight: 700;
            cursor: pointer; box-shadow: var(--card-shadow);
            transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }
        .vqe-btn:hover { background: #B91C1C; border-color: #B91C1C; color: #fff; transform: translateY(-1px); }
        .vqe-btn:active { transform: scale(0.97); }
        .vqe-hint { font-size: 10.5px; font-weight: 500; opacity: 0.75; }
        @media (max-width: 600px) { .vqe-hint { display: none; } }
    `;
    document.head.appendChild(s);
}

const IcoExit = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
);

export default function QuickExit({ bottom = 86 }) {
    // A ref, not state: the tap count is never rendered, and using state would
    // re-render the whole tree on every Escape press.
    const taps = useRef(0);

    const leave = () => {
        try { DRAFT_KEYS.forEach(k => localStorage.removeItem(k)); } catch {}
        // New tab first so something innocuous is on screen even if the
        // replace below is slowed by the network.
        try { window.open(EXIT_URL, '_blank', 'noopener')?.focus(); } catch {}
        try { window.location.replace(EXIT_URL); } catch { window.location.href = EXIT_URL; }
    };

    // Triple-Escape shortcut, reset if the presses are more than 1.2s apart.
    useEffect(() => {
        let timer;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            taps.current += 1;
            if (taps.current >= 3) { taps.current = 0; leave(); return; }
            clearTimeout(timer);
            timer = setTimeout(() => { taps.current = 0; }, 1200);
        };
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer); };
    }, []);

    return (
        <button
            type="button"
            className="vqe-btn"
            style={{ bottom }}
            onClick={leave}
            title="Leave this site immediately (or press Escape three times)"
            aria-label="Leave this site immediately. Opens a neutral page and removes this site from your browser history.">
            <IcoExit />
            Quick Exit
            <span className="vqe-hint">Esc x3</span>
        </button>
    );
}
