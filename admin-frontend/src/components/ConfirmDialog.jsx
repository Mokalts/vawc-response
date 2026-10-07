import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";

// Promise-based confirm dialog. Usage:  if (!(await confirmDialog({...}))) return;
let _open = null;

export function confirmDialog(opts = {}) {
    return new Promise((resolve) => {
        if (_open) _open({ ...opts, resolve });
        // No host mounted. window.confirm cannot ask anyone to type anything,
        // so a dialog that wanted a typed confirmation refuses instead of
        // quietly degrading to a single OK on something irreversible.
        else if (opts.requireText) resolve(false);
        else resolve(window.confirm(opts.message || "Are you sure?"));
    });
}

const FF = "'Lexend', sans-serif";

// Mount <ConfirmHost /> once (in AdminLayout). It renders the dialog on demand.
export function ConfirmHost() {
    const [state, setState] = useState(null);
    // What the officer has typed, when the dialog asks them to type something.
    const [typed, setTyped] = useState("");

    useEffect(() => {
        _open = (s) => { setTyped(""); setState(s); };
        return () => { _open = null; };
    }, []);

    // Set only when the caller asked for a typed confirmation. An action that
    // cannot be undone should not be reachable by hitting Enter twice, so while
    // this is on, Enter does nothing and the confirm button stays disabled
    // until the exact words are there.
    const requireText = state && state.requireText ? String(state.requireText) : null;
    const matched = !requireText || typed.trim().toLowerCase() === requireText.trim().toLowerCase();

    useEffect(() => {
        if (!state) return;
        const onKey = (e) => {
            if (e.key === "Escape") { state.resolve(false); setState(null); }
            if (e.key === "Enter" && !requireText) { state.resolve(true); setState(null); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [state, requireText]);

    if (!state) return null;

    const done = (result) => { const r = state.resolve; setState(null); r(result); };
    const danger = !!state.danger;
    const accent       = danger ? "#DC2626" : "#F47920";
    const accentBg     = danger ? "#FEF2F2" : "#FFF3E0";
    const accentBorder = danger ? "#FECACA" : "#FFCC99";
    const shadow       = danger ? "rgba(220,38,38,0.3)" : "rgba(196,94,16,0.3)";

    return ReactDOM.createPortal(
        <div onClick={() => done(false)} style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: FF }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--adm-card)", borderRadius: 18, width: "100%", maxWidth: 420, padding: 24, boxShadow: "0 24px 64px rgba(15,23,42,0.3)", animation: "adm-popIn 0.2s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 13, background: accentBg, border: `1px solid ${accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="12" y1="9" x2="12" y2="13" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
                            <line x1="12" y1="17" x2="12.01" y2="17" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
                        </svg>
                    </div>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--adm-text)", letterSpacing: "-0.2px" }}>{state.title || "Are you sure?"}</p>
                </div>
                <p style={{ margin: requireText ? "0 0 14px" : "0 0 22px", fontSize: 13.5, color: "var(--adm-text-2)", lineHeight: requireText ? 1.55 : 1.65, whiteSpace: "pre-line" }}>{state.message}</p>

                {requireText && (
                    <div style={{ marginBottom: 18 }}>
                        <label htmlFor="adm-confirm-text" style={{ display: "block", fontSize: 12.5, color: "var(--adm-text-2)", marginBottom: 6, lineHeight: 1.45 }}>
                            {state.requireLabel || "Type this to confirm:"}
                        </label>
                        {/* The thing to copy out sits on its own line. Trailing
                            it after the label put a long email halfway across
                            and broke it mid-word, which is the one string here
                            that has to be read character by character. */}
                        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--adm-text)", lineHeight: 1.4, overflowWrap: "anywhere" }}>
                            {requireText}
                        </p>
                        <input
                            id="adm-confirm-text"
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            autoFocus
                            autoComplete="off"
                            spellCheck={false}
                            aria-describedby="adm-confirm-hint"
                            style={{
                                width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10,
                                border: `1.5px solid ${typed && !matched ? "#FECACA" : "var(--adm-border)"}`,
                                background: "var(--adm-card)", color: "var(--adm-text)",
                                fontSize: 13.5, fontFamily: FF, outline: "none",
                            }}
                        />
                        <p id="adm-confirm-hint" role={typed && !matched ? "alert" : undefined}
                           style={{ margin: "6px 0 0", fontSize: 12, minHeight: 15, color: typed && !matched ? "#B91C1C" : "var(--adm-text-muted)", lineHeight: 1.4 }}>
                            {typed && !matched ? "That does not match yet." : " "}
                        </p>
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button onClick={() => done(false)} style={{ padding: "9px 18px", borderRadius: 10, border: "1.5px solid var(--adm-border)", background: "var(--adm-card)", color: "var(--adm-text-2)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: FF }}>
                        {state.cancelLabel || "Cancel"}
                    </button>
                    <button onClick={() => matched && done(true)} disabled={!matched} autoFocus={!requireText}
                        style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: accent, color: "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: FF, cursor: matched ? "pointer" : "not-allowed", opacity: matched ? 1 : 0.45, boxShadow: matched ? `0 4px 12px ${shadow}` : "none" }}>
                        {state.confirmLabel || "Confirm"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
