import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";

// ─── Barangay constants (move to .env in Sprint 3 Item 10) ─────────────────
const BARANGAY = {
    name:     "BARANGAY PALANGINAN",
    province: "Province of Zambales",
    municipality: "Municipality of Iba",
    logo:     "/barangay-logo.png",
};
const OFFICERS = {
    vawc_officer:     { name: "MARIA THERESA M. DE LEON", title: "VAWC Officer" },
    pangkat_secretary:{ name: "SANTOS E. DALIPOSA",       title: "Pangkat Secretary" },
    pangkat_chairman: { name: "GILBERT C. DOLOJAN",       title: "Pangkat Chairman" },
    punong_barangay:  { name: "HON. EDMOND P. BALTAZAR",  title: "Punong Barangay" },
};
const POLICE_REFERRAL = "Chief of Police, Iba MPS";

// ─── CSS - print-aware ──────────────────────────────────────────────────────
const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Times:wght@400;700&display=swap');
    @page { size: A4; margin: 0.75in; }

    .pd-wrap { background: #E2E8F0; min-height: 100vh; padding: 24px 16px 60px; font-family: 'DM Sans', sans-serif; }
    .pd-toolbar {
        max-width: 8.27in; margin: 0 auto 16px;
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; flex-wrap: wrap;
    }
    .pd-toolbar h1 { margin: 0; font-size: 18px; font-weight: 700; color: #0F172A; font-family: 'DM Sans', sans-serif; }
    .pd-toolbar p  { margin: 2px 0 0; font-size: 12.5px; color: #475569; font-family: 'DM Sans', sans-serif; }
    .pd-btn {
        padding: 10px 18px; border-radius: 8px; border: none;
        background: #F47920; color: #fff; font-size: 13.5px; font-weight: 700;
        cursor: pointer; font-family: 'DM Sans', sans-serif;
        display: inline-flex; align-items: center; gap: 8px;
        box-shadow: 0 2px 6px rgba(244,121,32,0.3);
    }
    .pd-btn:hover { background: #C45E10; }
    .pd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .pd-btn-ghost {
        padding: 10px 16px; border-radius: 8px;
        border: 1.5px solid #CBD5E1; background: #fff; color: #475569;
        font-size: 13px; font-weight: 600; cursor: pointer;
        font-family: 'DM Sans', sans-serif;
    }
    .pd-banner {
        max-width: 8.27in; margin: 0 auto 16px;
        background: #FFF3E0; border: 1.5px solid #FFCC99; border-radius: 8px;
        padding: 12px 16px; font-size: 12.5px; color: #C45E10; font-family: 'DM Sans', sans-serif;
    }
    .pd-paper {
        background: #fff;
        max-width: 8.27in;
        min-height: 11.69in;
        margin: 0 auto;
        padding: 0.75in 0.85in;
        box-shadow: 0 4px 20px rgba(15,23,42,0.12);
        font-family: 'Times New Roman', Times, serif;
        color: #000;
        font-size: 13px;
        line-height: 1.5;
    }

    /* Header */
    .pd-header { display: grid; grid-template-columns: 100px 1fr 100px; align-items: center; margin-bottom: 24px; }
    .pd-header img { width: 90px; height: 90px; object-fit: contain; }
    .pd-header .pd-title { text-align: center; }
    .pd-header .pd-title p { margin: 0; font-family: 'Times New Roman', Times, serif; font-size: 13px; }
    .pd-header .pd-title .pd-brgy { font-weight: 700; font-size: 14px; margin-top: 2px; }
    .pd-header .pd-title .pd-office { margin-top: 10px; font-weight: 700; font-size: 13px; }

    /* Body */
    .pd-case-no { text-align: right; margin: 0 0 14px; font-size: 13px; }
    .pd-case-no span { text-decoration: underline; }
    .pd-section-title { text-align: center; font-weight: 700; font-size: 16px; letter-spacing: 0.18em; margin: 18px 0 22px; }
    .pd-section-title-cfa { text-align: center; font-weight: 700; font-size: 14.5px; letter-spacing: 0.05em; margin: 16px 0 18px; text-decoration: underline; }
    .pd-block { margin-bottom: 14px; }
    .pd-name { font-weight: 700; text-decoration: underline; }
    .pd-label { font-style: italic; }
    .pd-against { margin: 8px 0 8px 0; }
    .pd-to { display: flex; gap: 22px; margin: 18px 0 6px; }
    .pd-to-label { font-weight: 700; min-width: 30px; }
    .pd-para { margin: 0 0 12px; text-align: justify; text-indent: 2em; }
    .pd-warn { font-weight: 700; }

    /* Inputs that print as plain text */
    .pd-input {
        border: none;
        border-bottom: 1.5px solid #000;
        background: transparent;
        padding: 0 4px;
        font-family: 'Times New Roman', Times, serif;
        font-size: 13px;
        font-weight: 700;
        text-align: center;
        outline: none;
        min-width: 60px;
    }
    .pd-input-long { min-width: 160px; }
    .pd-input:focus { background: #FFF3E0; }

    /* Signatures */
    .pd-sign-row { display: flex; justify-content: flex-end; margin-top: 28px; }
    .pd-sign-col { text-align: center; min-width: 240px; }
    .pd-sign-col .pd-sign-name { font-weight: 700; }
    .pd-sign-col .pd-sign-title { font-style: italic; font-size: 12.5px; }

    .pd-ack { margin-top: 50px; }
    .pd-ack-line { display: flex; flex-direction: column; align-items: center; margin-top: 24px; }
    .pd-ack-line .pd-line { width: 280px; border-top: 1px solid #000; margin-bottom: 4px; }

    .pd-cfa-list { list-style: none; padding: 0; margin: 0 0 18px; }
    .pd-cfa-list li { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
    .pd-cfa-box { width: 13px; height: 13px; border: 1.5px solid #000; flex-shrink: 0; margin-top: 3px; }
    .pd-cfa-box.checked::after { content: "✓"; display: block; font-weight: 700; text-align: center; line-height: 10px; font-size: 14px; }

    .pd-cfa-signs { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 24px; }
    .pd-cfa-attest { margin-top: 30px; }

    .pd-endorsement-title { text-align: center; font-size: 14px; font-weight: 700; margin: 28px 0 4px; }
    .pd-endorsement-title sup { font-size: 9px; vertical-align: super; }
    .pd-endorsement-date { text-align: center; font-size: 12.5px; margin: 0 0 26px; }

    /* Print mode */
    @media print {
        /* margin:0 removes the browser's auto header/footer (date, page title, URL) */
        @page { size: A4; margin: 0; }
        html, body { background: #fff !important; margin: 0 !important; }
        .pd-wrap { background: #fff !important; padding: 0 !important; }
        .pd-toolbar, .pd-banner { display: none !important; }
        /* padding moved here so the document keeps its margins without the browser header/footer */
        .pd-paper { box-shadow: none !important; margin: 0 !important; padding: 0.75in 0.85in !important; max-width: none !important; min-height: 0 !important; }
        .pd-input { border-bottom: 1.5px solid #000 !important; background: transparent !important; }
    }
`;

// ─── Helpers ────────────────────────────────────────────────────────────────
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const todayParts = () => {
    const d = new Date();
    return { day: d.getDate(), month: monthNames[d.getMonth()], year: d.getFullYear() };
};

// ─── Document Header (shared) ───────────────────────────────────────────────
const DocHeader = ({ office }) => (
    <div className="pd-header">
        <img src={BARANGAY.logo} alt="Barangay Palanginan Seal" />
        <div className="pd-title">
            <p>Republic of the Philippines</p>
            <p>{BARANGAY.province}</p>
            <p>{BARANGAY.municipality}</p>
            <p className="pd-brgy">{BARANGAY.name}</p>
            <p className="pd-office">{office}</p>
        </div>
        <div />
    </div>
);

// ─── Summon Letter ──────────────────────────────────────────────────────────
const SummonLetter = ({ cas, victim, fields, setFields }) => {
    const today = todayParts();
    return (
        <div className="pd-paper">
            <DocHeader office="OFFICE OF THE KATARUNGANG PAMBARANGAY" />

            <p className="pd-case-no">
                VAWC Case No. <span>{cas.case_number || "____"}</span><br />
                For: <input className="pd-input pd-input-long" value={fields.caseFor} onChange={e => setFields({ ...fields, caseFor: e.target.value })} placeholder="case type" />
            </p>

            <div className="pd-block">
                <p className="pd-name">{victim.full_name || "-"}</p>
                <p>{victim.address || "-"}</p>
                <p className="pd-label">(Complainant/s)</p>
            </div>

            <p className="pd-against">-against-</p>

            <div className="pd-block">
                <p className="pd-name">{cas.offender_name || "-"}</p>
                <input className="pd-input pd-input-long" value={fields.respondentAddress} onChange={e => setFields({ ...fields, respondentAddress: e.target.value })} placeholder="respondent address" style={{ display: "block", width: "60%", textAlign: "left", marginBottom: 4 }} />
                <p className="pd-label">(Respondent/s)</p>
            </div>

            <h2 className="pd-section-title">S U M M O N S</h2>

            <div className="pd-to">
                <div className="pd-to-label">TO:</div>
                <div>
                    <p className="pd-name">{cas.offender_name || "-"}</p>
                    <p>{fields.respondentAddress || "(respondent address)"}</p>
                    <p className="pd-label">(Respondent/s)</p>
                </div>
            </div>

            <p className="pd-para">
                You are hereby summoned to appear before me in person together with your witnesses on the{" "}
                <input className="pd-input" value={fields.hearingDay} onChange={e => setFields({ ...fields, hearingDay: e.target.value })} placeholder="day" /> day of{" "}
                <input className="pd-input" value={fields.hearingMonth} onChange={e => setFields({ ...fields, hearingMonth: e.target.value })} placeholder="month" />, {today.year} at{" "}
                <input className="pd-input" value={fields.hearingTime} onChange={e => setFields({ ...fields, hearingTime: e.target.value })} placeholder="time" /> o'clock in the{" "}
                <input className="pd-input" value={fields.hearingPeriod} onChange={e => setFields({ ...fields, hearingPeriod: e.target.value })} placeholder="morning/afternoon" /> then and there to answer to a complaint made before me, a copy of which attached here to for mediation/conciliation of your dispute with the complainant/s.
            </p>

            <p className="pd-para">
                You are hereby warned that if you refuse or willfully fail to appear in obedience to this summons, you may be barred from any counterclaim arising from said complainant/s.
            </p>

            <p className="pd-para">
                <span className="pd-warn">FAIL NOT</span> or else face punishment as for <span className="pd-warn">CONTEMPT OF COURT</span>.
            </p>

            <p style={{ marginTop: 14 }}>
                This <input className="pd-input" value={fields.issueDay} onChange={e => setFields({ ...fields, issueDay: e.target.value })} placeholder="day" /> day of{" "}
                <input className="pd-input" value={fields.issueMonth} onChange={e => setFields({ ...fields, issueMonth: e.target.value })} placeholder="month" />, {today.year}.
            </p>

            <div className="pd-sign-row">
                <div className="pd-sign-col">
                    <div style={{ height: 36 }} />
                    <p className="pd-sign-name">{OFFICERS.vawc_officer.name}</p>
                    <p className="pd-sign-title">{OFFICERS.vawc_officer.title}</p>
                </div>
            </div>

            <p style={{ marginTop: 22 }}><strong>NOTE/REMARKS:</strong><br />1<sup>st</sup> notice of hearing</p>

            <div className="pd-ack">
                <div className="pd-ack-line">
                    <div className="pd-line" />
                    <p style={{ margin: 0, fontStyle: "italic" }}>Acknowledgement (Respondent)</p>
                </div>
                <div className="pd-ack-line" style={{ marginTop: 30 }}>
                    <div className="pd-line" />
                    <p style={{ margin: 0 }}>Signed by Warrant Officer</p>
                </div>
            </div>
        </div>
    );
};

// ─── Certificate to File Action ─────────────────────────────────────────────
const CertificateFileAction = ({ cas, victim, fields, setFields }) => {
    const today = todayParts();
    return (
        <div className="pd-paper">
            <DocHeader office="OFFICE OF THE LUPONG TAGAPAMAYAPA" />

            <p className="pd-case-no">
                Barangay Case No. <span>{cas.case_number || "____"}</span><br />
                For: <input className="pd-input pd-input-long" value={fields.caseFor} onChange={e => setFields({ ...fields, caseFor: e.target.value })} placeholder="case name" />
            </p>

            <div className="pd-block">
                <p className="pd-name">{victim.full_name || "-"}</p>
                <p>{victim.address || "-"}</p>
                <p className="pd-label">Complainant/s</p>
            </div>

            <p className="pd-against">-Against-</p>

            <div className="pd-block">
                <p className="pd-name">{cas.offender_name || "-"}</p>
                <input className="pd-input pd-input-long" value={fields.respondentAddress} onChange={e => setFields({ ...fields, respondentAddress: e.target.value })} placeholder="respondent address" style={{ display: "block", width: "60%", textAlign: "left", marginBottom: 4 }} />
                <p className="pd-label">Respondent/s</p>
            </div>

            <h2 className="pd-section-title-cfa">CERTIFICATION TO FILE ACTION</h2>

            <p style={{ marginBottom: 8 }}>This is to certify that:</p>

            <ul className="pd-cfa-list">
                <li>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                        <input type="checkbox" checked={fields.cb1} onChange={e => setFields({ ...fields, cb1: e.target.checked })} style={{ marginTop: 3 }} />
                        <span>There has been a personal confrontation between the parties before the Punong Barangay/Pangkat ng Tagapamayapa;</span>
                    </label>
                </li>
                <li>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                        <input type="checkbox" checked={fields.cb2} onChange={e => setFields({ ...fields, cb2: e.target.checked })} style={{ marginTop: 3 }} />
                        <span>An amicable settlement/agreement to arbitrate was reached;</span>
                    </label>
                </li>
                <li>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                        <input type="checkbox" checked={fields.cb3} onChange={e => setFields({ ...fields, cb3: e.target.checked })} style={{ marginTop: 3 }} />
                        <span>
                            The settlement/agreement has been repudiated in a statement sworn to before the Punong Barangay{" "}
                            <input className="pd-input" value={fields.repudiatedDate} onChange={e => setFields({ ...fields, repudiatedDate: e.target.value })} placeholder="date" /> on ground{" "}
                            <input className="pd-input pd-input-long" value={fields.repudiatedGround} onChange={e => setFields({ ...fields, repudiatedGround: e.target.value })} placeholder="reason" />; and
                        </span>
                    </label>
                </li>
                <li>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                        <input type="checkbox" checked={fields.cb4} onChange={e => setFields({ ...fields, cb4: e.target.checked })} style={{ marginTop: 3 }} />
                        <span>Therefore, the corresponding complaint for the dispute may now be filed in court/government office.</span>
                    </label>
                </li>
            </ul>

            <p>Issued this <input className="pd-input" value={fields.issueDay} onChange={e => setFields({ ...fields, issueDay: e.target.value })} placeholder="day" /> day of{" "}
                <input className="pd-input" value={fields.issueMonth} onChange={e => setFields({ ...fields, issueMonth: e.target.value })} placeholder="month" />, {today.year}.
            </p>

            <div className="pd-cfa-signs">
                <div />
                <div style={{ textAlign: "center" }}>
                    <div style={{ height: 28 }} />
                    <p className="pd-sign-name">{OFFICERS.pangkat_secretary.name}</p>
                    <p className="pd-sign-title">{OFFICERS.pangkat_secretary.title}</p>
                </div>
            </div>

            <div className="pd-cfa-attest">
                <p style={{ margin: 0 }}>Attested by:</p>
                <div style={{ marginTop: 26 }}>
                    <p className="pd-sign-name">{OFFICERS.pangkat_chairman.name}</p>
                    <p className="pd-sign-title">{OFFICERS.pangkat_chairman.title}</p>
                </div>
            </div>

            <div className="pd-sign-row" style={{ marginTop: 30 }}>
                <div className="pd-sign-col">
                    <div style={{ height: 24 }} />
                    <p className="pd-sign-name">{OFFICERS.punong_barangay.name}</p>
                    <p className="pd-sign-title">PB/Lupon Chairman</p>
                </div>
            </div>
        </div>
    );
};

// ─── Endorsement Letter ─────────────────────────────────────────────────────
const EndorsementLetter = ({ cas, victim, fields, setFields }) => {
    const today = todayParts();
    return (
        <div className="pd-paper">
            <DocHeader office="OFFICE OF THE PUNONG BARANGAY" />

            <h2 className="pd-endorsement-title">1<sup>ST</sup> Endorsement</h2>
            <p className="pd-endorsement-date">{`${fields.endorsementMonth || monthNames[new Date().getMonth()]} ${fields.endorsementDay || new Date().getDate()}, ${today.year}`}</p>

            <p className="pd-para" style={{ textIndent: "2em", marginTop: 14 }}>
                Respectfully endorsed to the <strong>{POLICE_REFERRAL}</strong> the attached blotter on the complaint of{" "}
                <span className="pd-name">{victim.full_name || "-"}</span> of <span className="pd-name">{victim.address || "-"}</span>{" "}
                against the respondent <span className="pd-name">{cas.offender_name || "-"}</span> of{" "}
                <input className="pd-input pd-input-long" value={fields.respondentAddress} onChange={e => setFields({ ...fields, respondentAddress: e.target.value })} placeholder="respondent address" />{" "}
                for <span className="pd-name" style={{ textTransform: "uppercase" }}>{fields.caseFor || "-"}</span>.
            </p>

            <div style={{ marginTop: 32 }}>
                <p style={{ margin: 0, fontSize: 12.5 }}>Endorsement Date:</p>
                <input className="pd-input" value={fields.endorsementDay} onChange={e => setFields({ ...fields, endorsementDay: e.target.value })} placeholder="day" />{" "}
                <input className="pd-input" value={fields.endorsementMonth} onChange={e => setFields({ ...fields, endorsementMonth: e.target.value })} placeholder="month" />, {today.year}
            </div>

            <div className="pd-sign-row" style={{ marginTop: 80 }}>
                <div className="pd-sign-col">
                    <div style={{ height: 36 }} />
                    <p className="pd-sign-name">{OFFICERS.punong_barangay.name}</p>
                    <p className="pd-sign-title">{OFFICERS.punong_barangay.title}</p>
                </div>
            </div>
        </div>
    );
};

// ─── Main page ──────────────────────────────────────────────────────────────
const DOC_TYPES = {
    summon:      { component: SummonLetter,          title: "Summon Letter",             office: "Katarungang Pambarangay" },
    cfa:         { component: CertificateFileAction, title: "Certificate to File Action", office: "Lupong Tagapamayapa" },
    endorsement: { component: EndorsementLetter,     title: "Endorsement Letter",          office: "Punong Barangay" },
};

export default function PrintDocument() {
    const { type, caseId } = useParams();
    const navigate = useNavigate();
    const [cas, setCas] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const today = todayParts();
    const [fields, setFields] = useState({
        caseFor:           "",
        respondentAddress: "",
        hearingDay:        "",
        hearingMonth:      "",
        hearingTime:       "",
        hearingPeriod:     "morning",
        issueDay:          String(today.day),
        issueMonth:        today.month,
        cb1: false, cb2: false, cb3: false, cb4: false,
        repudiatedDate:    "",
        repudiatedGround:  "",
        endorsementDay:    String(today.day),
        endorsementMonth:  today.month,
    });

    useEffect(() => {
        api.get(`/admin/cases/${caseId}`)
            .then(r => {
                setCas(r.data);
                // Auto-fill the "For:" field from incident type if available on any report
                const firstReport = (r.data.reports || [])[0];
                const incidentType = firstReport?.incident_type;
                if (incidentType) setFields(f => ({ ...f, caseFor: incidentType }));
            })
            .catch(err => setError(err.response?.data?.detail || "Failed to load case."))
            .finally(() => setLoading(false));
    }, [caseId]);

    // Set the document title so "Save as PDF" defaults the filename to the case number.
    useEffect(() => {
        const prev = document.title;
        const docCfg = DOC_TYPES[type];
        if (docCfg && cas?.case_number) {
            document.title = `${docCfg.title} - ${cas.case_number}`.replace(/[\\/:*?"<>|]/g, "-");
        }
        return () => { document.title = prev; };
    }, [type, cas]);

    const cfg = DOC_TYPES[type];
    if (!cfg) {
        return (
            <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Sans',sans-serif" }}>
                <p style={{ color: "#C62828" }}>Unknown document type: <code>{type}</code></p>
                <button onClick={() => navigate(-1)}>Back</button>
            </div>
        );
    }

    if (loading) return <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Sans',sans-serif" }}>Loading case…</div>;
    if (error)  return <div style={{ padding: 40, textAlign: "center", color: "#C62828", fontFamily: "'DM Sans',sans-serif" }}>{error}</div>;
    if (!cas)   return null;

    const victim = cas.victim || {};
    const isRestricted = !!cas.restricted;
    const Doc = cfg.component;

    return (
        <>
            <style>{CSS}</style>
            <div className="pd-wrap">
                <div className="pd-toolbar">
                    <div>
                        <h1>{cfg.title}</h1>
                        <p>{cfg.office} · Case {cas.case_number}</p>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button className="pd-btn-ghost" onClick={() => navigate(`/reports/${caseId}`)}>← Back to case</button>
                        <button className="pd-btn" onClick={() => window.print()} disabled={isRestricted}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <rect x="6" y="14" width="12" height="8" rx="1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Print Document
                        </button>
                    </div>
                </div>

                {isRestricted && (
                    <div className="pd-banner">
                        <strong>Restricted view -</strong> Sensitive fields are masked. Super Admin access is required to produce a printable official document.
                    </div>
                )}

                <Doc cas={cas} victim={victim} fields={fields} setFields={setFields} />
            </div>
        </>
    );
}
