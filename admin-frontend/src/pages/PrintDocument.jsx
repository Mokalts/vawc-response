import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/api";

// ─── Barangay constants ──────────────────────────────────────────────────────
const BARANGAY = {
    name: "BARANGAY PALANGINAN",
    province: "Province of Zambales",
    municipality: "Municipality of Iba",
    logo: "/barangay-logo.png",
};

// ─── CSS - print-aware ──────────────────────────────────────────────────────
const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Times:wght@400;700&display=swap');
    @page { size: A4; margin: 0.75in; }

    .pd-wrap { background: #E2E8F0; min-height: 100vh; padding: 24px 16px 60px; font-family: 'Lexend', sans-serif; }
    .pd-toolbar { max-width: 8.27in; margin: 0 auto 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .pd-toolbar h1 { margin: 0; font-size: 18px; font-weight: 700; color: #0F172A; font-family: 'Lexend', sans-serif; }
    .pd-toolbar p  { margin: 2px 0 0; font-size: 12.5px; color: #475569; font-family: 'Lexend', sans-serif; }
    .pd-btn { padding: 10px 18px; border-radius: 8px; border: none; background: #F47920; color: #fff; font-size: 13.5px; font-weight: 700; cursor: pointer; font-family: 'Lexend', sans-serif; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(244,121,32,0.3); }
    .pd-btn:hover { background: #C45E10; }
    .pd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .pd-btn-ghost { padding: 10px 16px; border-radius: 8px; border: 1.5px solid #CBD5E1; background: #fff; color: #475569; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Lexend', sans-serif; }
    .pd-banner { max-width: 8.27in; margin: 0 auto 16px; background: #FFF3E0; border: 1.5px solid #FFCC99; border-radius: 8px; padding: 12px 16px; font-size: 12.5px; color: #C45E10; font-family: 'Lexend', sans-serif; }

    .pd-paper { background: #fff; max-width: 8.27in; min-height: 11.69in; margin: 0 auto; padding: 0.75in 0.85in; box-shadow: 0 4px 20px rgba(15,23,42,0.12); font-family: 'Times New Roman', Times, serif; color: #000; font-size: 13px; line-height: 1.55; }

    .pd-header { display: grid; grid-template-columns: 100px 1fr 100px; align-items: center; margin-bottom: 20px; }
    .pd-header img { width: 90px; height: 90px; object-fit: contain; }
    .pd-header .pd-title { text-align: center; }
    .pd-header .pd-title p { margin: 0; font-family: 'Times New Roman', Times, serif; font-size: 13px; }
    .pd-header .pd-title .pd-brgy { font-weight: 700; font-size: 14px; margin-top: 2px; }
    .pd-header .pd-title .pd-office { margin-top: 8px; font-weight: 700; font-size: 13px; }

    .pd-doctitle { text-align: center; font-weight: 700; font-size: 15px; letter-spacing: 0.06em; margin: 14px 0 18px; text-decoration: underline; }
    .pd-case-no { text-align: right; margin: 0 0 14px; font-size: 13px; }
    .pd-para { margin: 0 0 12px; text-align: justify; }
    .pd-para.indent { text-indent: 2em; }
    .pd-block { margin-bottom: 12px; }
    .pd-label { font-style: italic; font-size: 12px; }
    .pd-warn { font-weight: 700; }
    .pd-row { display: flex; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; align-items: baseline; }
    .pd-fieldlabel { font-weight: 700; }

    .pd-input { border: none; border-bottom: 1px solid #000; background: transparent; padding: 0 4px; font-family: 'Times New Roman', Times, serif; font-size: 13px; outline: none; min-width: 60px; }
    .pd-input.b { font-weight: 700; }
    .pd-input.grow { min-width: 180px; flex: 1; }
    .pd-input:focus { background: #FFF3E0; }
    .pd-ta { width: 100%; box-sizing: border-box; border: 1px solid #999; background: transparent; padding: 6px 8px; font-family: 'Times New Roman', Times, serif; font-size: 13px; outline: none; resize: vertical; min-height: 90px; }
    .pd-ta:focus { background: #FFF3E0; }
    .pd-name { font-weight: 700; text-decoration: underline; }
    .pd-edit { border: none; border-bottom: 1px dashed #B0B0B0; background: transparent; font-family: inherit; font-size: inherit; font-weight: 700; text-align: center; outline: none; min-width: 180px; }
    .pd-edit:focus { background: #FFF3E0; }
    .pd-year { width: 3.6em; min-width: 0; text-align: center; }

    .pd-check { list-style: none; padding: 0; margin: 8px 0 14px; }
    .pd-check li { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
    .pd-box { width: 13px; height: 13px; border: 1.5px solid #000; flex-shrink: 0; margin-top: 3px; display: inline-block; text-align: center; line-height: 11px; font-weight: 700; font-size: 12px; }

    .pd-tbl { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
    .pd-tbl th, .pd-tbl td { border: 1px solid #000; padding: 4px 6px; font-size: 12px; }
    .pd-tbl th { font-weight: 700; text-align: center; }

    .pd-signs { display: flex; justify-content: space-between; gap: 40px; margin-top: 44px; }
    .pd-sign { flex: 1; text-align: center; }
    .pd-sign .pd-sname { font-weight: 700; text-decoration: underline; }
    .pd-sign .pd-stitle { font-style: italic; font-size: 12px; }
    .pd-sign-label { font-style: italic; font-size: 12px; text-align: left; margin-bottom: 26px; }

    .pd-ack { margin-top: 42px; border-top: 1px dashed #999; padding-top: 12px; }
    .pd-ack h4 { margin: 0 0 12px; font-size: 12.5px; }
    .pd-ackrow { display: flex; gap: 30px; flex-wrap: wrap; }

    @media print {
        @page { size: A4; margin: 0; }
        html, body { background: #fff !important; margin: 0 !important; }
        .pd-wrap { background: #fff !important; padding: 0 !important; }
        .pd-toolbar, .pd-banner { display: none !important; }
        .pd-paper { box-shadow: none !important; margin: 0 !important; padding: 0.7in 0.8in !important; max-width: none !important; min-height: 0 !important; }
        .pd-input, .pd-ta { border-color: #000 !important; background: transparent !important; }
        .pd-edit { border-bottom: none !important; background: transparent !important; }
        .pd-ta { border: 1px solid #000 !important; }
    }
`;

// ─── Helpers ────────────────────────────────────────────────────────────────
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const todayParts = () => { const d = new Date(); return { day: d.getDate(), month: monthNames[d.getMonth()], year: d.getFullYear() }; };
const fmtDate = (d) => !d ? "" : new Date(d).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
const INCIDENT_LABEL = { physical: "Physical Abuse", sexual: "Sexual Abuse", psychological: "Psychological Abuse", economic: "Economic Abuse", others: "Other" };
const abuseText = (r) => {
    if (!r) return "";
    const list = (r.incident_types && r.incident_types.length ? r.incident_types : (r.incident_type ? [r.incident_type] : []));
    return list.map(t => INCIDENT_LABEL[t] || t).join(", ");
};

const DocHeader = ({ office }) => (
    <div className="pd-header">
        <img src={BARANGAY.logo} alt="Barangay Palanginan Seal" onError={(e) => { e.target.style.display = "none"; }} />
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

const Editable = ({ v, on, ph, cls = "" }) => (
    <input className={`pd-edit ${cls}`} value={v} onChange={e => on(e.target.value)} placeholder={ph} />
);

// ─── 1. Blotter Form ──────────────────────────────────────────────────────────
const BlotterForm = ({ cas, victim, report, F, set }) => (
    <div className="pd-paper">
        <DocHeader office="OFFICE OF THE SANGGUNIANG BARANGAY" />
        <p className="pd-doctitle">BARANGAY BLOTTER</p>
        <p className="pd-case-no">Blotter/Entry No. <Editable v={F.blotterNo} on={v => set({ blotterNo: v })} ph="___" cls="pd-year" style={{}} /> &nbsp; Date: <Editable v={F.blotterDate} on={v => set({ blotterDate: v })} ph="date" /></p>

        <div className="pd-row"><span className="pd-fieldlabel">Reporter / Complainant:</span> <Editable v={F.complainantName} on={v => set({ complainantName: v })} ph="name" /></div>
        <div className="pd-row"><span className="pd-fieldlabel">Address:</span> <Editable v={F.complainantAddress} on={v => set({ complainantAddress: v })} ph="address" cls="pd-input grow" /></div>
        <div className="pd-row"><span className="pd-fieldlabel">Respondent:</span> <Editable v={F.respondentName} on={v => set({ respondentName: v })} ph="name" /></div>
        <div className="pd-row"><span className="pd-fieldlabel">Date &amp; place of incident:</span> <Editable v={F.incidentWhen} on={v => set({ incidentWhen: v })} ph="date/place" cls="pd-edit" /></div>
        <div className="pd-row"><span className="pd-fieldlabel">Nature of complaint:</span> <Editable v={F.nature} on={v => set({ nature: v })} ph="e.g. VAWC (RA 9262)" /></div>

        <p className="pd-fieldlabel" style={{ margin: "12px 0 4px" }}>Salaysay / Description of the incident:</p>
        <textarea className="pd-ta" value={F.narrative} onChange={e => set({ narrative: e.target.value })} />

        <p className="pd-fieldlabel" style={{ margin: "14px 0 4px" }}>Purpose ng pagpa-Blotter:</p>
        <ul className="pd-check">
            {[["p1", "Para maitala / for record purposes"], ["p2", "Para maghain ng reklamo / to file a complaint"], ["p3", "Para humingi ng tulong / to request assistance"]].map(([k, t]) => (
                <li key={k}><span className="pd-box" onClick={() => set({ [k]: !F[k] })} style={{ cursor: "pointer" }}>{F[k] ? "✓" : ""}</span> {t}</li>
            ))}
        </ul>
        {/* VAWC: the "schedule respondent for settlement" purpose is intentionally NOT offered (RA 9262 prohibits mediation/settlement). */}

        <div className="pd-signs">
            <div className="pd-sign">
                <div style={{ height: 30 }} />
                <p className="pd-sname"><Editable v={F.complainantName} on={v => set({ complainantName: v })} ph="complainant" /></p>
                <p className="pd-stitle">Signature of Complainant · Date &amp; Time</p>
            </div>
            <div className="pd-sign">
                <div style={{ height: 30 }} />
                <p className="pd-sname"><Editable v={F.vawcOfficer} on={v => set({ vawcOfficer: v })} ph="VAWC officer" /></p>
                <p className="pd-stitle">Assisted by (VAWC Officer)</p>
            </div>
        </div>
    </div>
);

// ─── 2. Pormal na Reklamo (VAWC complaint form) ────────────────────────────────
const ReklamoForm = ({ cas, victim, report, F, set }) => (
    <div className="pd-paper">
        <DocHeader office="BARANGAY VAW DESK" />
        <p className="pd-doctitle">PORMAL NA REKLAMO<br />LABAN SA PANG-AABUSO SA KABABAIHAN AT SA KANILANG ANAK</p>
        <p className="pd-case-no">VAWC Case No. <u>{cas.case_number || "____"}</u></p>

        <div className="pd-row"><span className="pd-fieldlabel">Nagrereklamo (Complainant):</span> <Editable v={F.complainantName} on={v => set({ complainantName: v })} ph="name" /></div>
        <div className="pd-row"><span className="pd-fieldlabel">Tirahan:</span> <Editable v={F.complainantAddress} on={v => set({ complainantAddress: v })} ph="address" cls="pd-input grow" /></div>
        <p className="pd-para" style={{ margin: "8px 0" }}>-laban kay-</p>
        <div className="pd-row"><span className="pd-fieldlabel">Inirereklamo (Respondent):</span> <Editable v={F.respondentName} on={v => set({ respondentName: v })} ph="name" /></div>
        <div className="pd-row"><span className="pd-fieldlabel">Kaugnayan (Relationship):</span> <Editable v={F.relationship} on={v => set({ relationship: v })} ph="e.g. Asawa / Live-in / Kasintahan / Kasambahay" cls="pd-input grow" /></div>
        <div className="pd-row"><span className="pd-fieldlabel">Uri ng pang-aabuso:</span> <Editable v={F.abuse} on={v => set({ abuse: v })} ph="physical / psychological / …" cls="pd-input grow" /></div>

        <p className="pd-fieldlabel" style={{ margin: "12px 0 4px" }}>Salaysay:</p>
        <textarea className="pd-ta" value={F.narrative} onChange={e => set({ narrative: e.target.value })} />

        <p className="pd-para" style={{ marginTop: 14 }}>Nilagdaan ngayong ika-<Editable v={F.day} on={v => set({ day: v })} ph="araw" cls="pd-year" /> ng <Editable v={F.month} on={v => set({ month: v })} ph="buwan" />, <input className="pd-input pd-year" value={F.year} onChange={e => set({ year: e.target.value })} />.</p>

        <div className="pd-signs">
            <div className="pd-sign">
                <div style={{ height: 30 }} />
                <p className="pd-sname"><Editable v={F.complainantName} on={v => set({ complainantName: v })} ph="complainant" /></p>
                <p className="pd-stitle">Lagda ng Nagrereklamo</p>
            </div>
            <div className="pd-sign">
                <div style={{ height: 30 }} />
                <p className="pd-sname"><Editable v={F.vawcOfficer} on={v => set({ vawcOfficer: v })} ph="VAWC officer" /></p>
                <p className="pd-stitle">Tinulungan ni (VAWC Officer)</p>
            </div>
        </div>
    </div>
);

// ─── 3. BPO Application ─────────────────────────────────────────────────────────
const BpoApplication = ({ cas, victim, report, F, set }) => {
    const children = cas.children || [];
    return (
        <div className="pd-paper">
            <DocHeader office="BARANGAY VAW DESK" />
            <p className="pd-doctitle">APPLICATION FOR BARANGAY PROTECTION ORDER</p>

            <div className="pd-row"><span className="pd-fieldlabel">1. Applicant:</span> <Editable v={F.applicantName} on={v => set({ applicantName: v })} ph="applicant" /></div>
            <div className="pd-row"><span className="pd-fieldlabel">Address / Contact:</span> <Editable v={F.applicantAddress} on={v => set({ applicantAddress: v })} ph="address / contact" cls="pd-input grow" /></div>
            <div className="pd-row"><span className="pd-fieldlabel">2. Victim:</span> <Editable v={F.complainantName} on={v => set({ complainantName: v })} ph="victim" /></div>
            <div className="pd-row"><span className="pd-fieldlabel">3. Respondent:</span> <Editable v={F.respondentName} on={v => set({ respondentName: v })} ph="respondent" /></div>
            <div className="pd-row"><span className="pd-fieldlabel">Relationship to respondent:</span> <Editable v={F.relationship} on={v => set({ relationship: v })} ph="relationship" cls="pd-input grow" /></div>

            <p className="pd-fieldlabel" style={{ margin: "12px 0 4px" }}>4. Children (if any):</p>
            <table className="pd-tbl">
                <thead><tr><th>Name</th><th>Date of Birth</th><th>Sex</th><th>Under applicant's care?</th></tr></thead>
                <tbody>
                    {children.length ? children.map((c, i) => (
                        <tr key={i}><td>{c.name || "-"}</td><td>{c.date_of_birth || "-"}</td><td style={{ textAlign: "center" }}>{c.sex || "-"}</td><td style={{ textAlign: "center" }}>{c.under_her_care ? "Yes" : "No"}</td></tr>
                    )) : <tr><td colSpan={4} style={{ textAlign: "center", fontStyle: "italic" }}>None recorded</td></tr>}
                </tbody>
            </table>

            <div className="pd-row"><span className="pd-fieldlabel">5. Acts complained of:</span> <Editable v={F.abuse} on={v => set({ abuse: v })} ph="acts of violence" cls="pd-input grow" /></div>
            <div className="pd-row"><span className="pd-fieldlabel">6. Date &amp; place of incident:</span> <Editable v={F.incidentWhen} on={v => set({ incidentWhen: v })} ph="date / place" cls="pd-input grow" /></div>

            <p className="pd-fieldlabel" style={{ margin: "12px 0 4px" }}>10. If the applicant is not the victim, state the circumstances / consent:</p>
            <textarea className="pd-ta" value={F.consent} onChange={e => set({ consent: e.target.value })} style={{ minHeight: 60 }} />

            <div className="pd-signs">
                <div className="pd-sign">
                    <div style={{ height: 30 }} />
                    <p className="pd-sname"><Editable v={F.applicantName} on={v => set({ applicantName: v })} ph="applicant" /></p>
                    <p className="pd-stitle">Signature of Applicant</p>
                </div>
                <div className="pd-sign">
                    <div style={{ height: 30 }} />
                    <p className="pd-sname"><Editable v={F.vawcOfficer} on={v => set({ vawcOfficer: v })} ph="VAWC officer" /></p>
                    <p className="pd-stitle">Assisted by (VAWC Officer)</p>
                </div>
            </div>
        </div>
    );
};

// ─── 4. Barangay Protection Order ─────────────────────────────────────────────
const BpoOrder = ({ cas, victim, report, F, set, bpo }) => {
    const reliefs = [];
    if (bpo?.relief_stop_physical_harm) reliefs.push("(a) prohibiting the respondent from causing physical harm to the victim;");
    if (bpo?.relief_stop_threats) reliefs.push("(b) prohibiting the respondent from threatening to cause the victim physical harm;");
    if (bpo?.relief_stay_away_100m) reliefs.push("(c) ordering the respondent to stay away from the victim at a distance of at least 100 meters.");
    return (
        <div className="pd-paper">
            <DocHeader office="OFFICE OF THE PUNONG BARANGAY" />
            <p className="pd-doctitle">BARANGAY PROTECTION ORDER</p>
            <p className="pd-case-no">BPO No. <u>{bpo?.bpo_number || "____"}</u>{bpo?.control_number ? <> · Control No. <u>{bpo.control_number}</u></> : null}</p>

            <div className="pd-row"><span className="pd-fieldlabel">Petitioner / Victim:</span> <Editable v={F.complainantName} on={v => set({ complainantName: v })} ph="victim" /></div>
            <div className="pd-row"><span className="pd-fieldlabel">Respondent:</span> <Editable v={F.respondentName} on={v => set({ respondentName: v })} ph="respondent" /></div>

            <p className="pd-para indent" style={{ marginTop: 12 }}>Finding the application sufficient, and pursuant to Republic Act No. 9262, the respondent is hereby ORDERED as follows:</p>
            {reliefs.length ? reliefs.map((r, i) => <p key={i} className="pd-para" style={{ textIndent: "1em" }}>{r}</p>)
                : <p className="pd-para" style={{ fontStyle: "italic" }}>(No reliefs recorded on the BPO — set them on the case before printing.)</p>}

            <p className="pd-para indent" style={{ fontWeight: 700 }}>
                This Barangay Protection Order is EFFECTIVE FOR FIFTEEN (15) DAYS from the date of issue and shall expire on {bpo?.expires_at ? fmtDate(bpo.expires_at) : "____________"}. It cannot be extended or renewed; a new order requires a new application based on a new act of violence.
            </p>

            <p className="pd-para" style={{ marginTop: 12 }}>Issued this {bpo?.issued_at ? fmtDate(bpo.issued_at) : "____________"}.</p>

            <div className="pd-signs">
                <div className="pd-sign" style={{ marginLeft: "auto", maxWidth: 280 }}>
                    <div style={{ height: 34 }} />
                    <p className="pd-sname"><Editable v={F.punongBarangay} on={v => set({ punongBarangay: v })} ph="Punong Barangay" style={{ textAlign: "center" }} /></p>
                    <p className="pd-stitle">Punong Barangay</p>
                </div>
            </div>
        </div>
    );
};

// ─── 5. 1st Endorsement ────────────────────────────────────────────────────────
const Endorsement1st = ({ cas, victim, report, F, set, endorsement }) => {
    const docs = (endorsement?.attached_documents && endorsement.attached_documents.length)
        ? endorsement.attached_documents.join(", ")
        : F.attachedDocs;
    const office = endorsement?.to_office_display || F.toOffice;
    const num = endorsement?.endorsement_number || 1;
    const ord = num === 1 ? "1st" : num === 2 ? "2nd" : num === 3 ? "3rd" : `${num}th`;
    return (
        <div className="pd-paper">
            <DocHeader office="OFFICE OF THE PUNONG BARANGAY" />
            <p className="pd-doctitle">{ord.toUpperCase()} ENDORSEMENT</p>
            <p className="pd-case-no">{endorsement?.date_endorsed ? fmtDate(endorsement.date_endorsed) : <Editable v={F.endorseDate} on={v => set({ endorseDate: v })} ph="date" />}</p>

            <p className="pd-para indent" style={{ marginTop: 12 }}>
                Respectfully endorsed to the <Editable v={endorsement ? office : F.toOffice} on={v => set({ toOffice: v })} ph="receiving office" cls="pd-input grow" /> the attached <Editable v={endorsement ? docs : F.attachedDocs} on={v => set({ attachedDocs: v })} ph="documents" cls="pd-input grow" /> on the complaint of{" "}
                <Editable v={F.complainantName} on={v => set({ complainantName: v })} ph="complainant" /> of <Editable v={F.complainantAddress} on={v => set({ complainantAddress: v })} ph="address" cls="pd-input" /> against the respondent{" "}
                <Editable v={F.respondentName} on={v => set({ respondentName: v })} ph="respondent" /> of <Editable v={F.respondentAddress} on={v => set({ respondentAddress: v })} ph="address" cls="pd-input" /> for{" "}
                <Editable v={endorsement?.purpose || F.purpose} on={v => set({ purpose: v })} ph="purpose" cls="pd-input grow" />.
            </p>

            <div className="pd-signs">
                <div className="pd-sign" style={{ marginLeft: "auto", maxWidth: 280 }}>
                    <div style={{ height: 34 }} />
                    <p className="pd-sname"><Editable v={F.punongBarangay} on={v => set({ punongBarangay: v })} ph="Punong Barangay" style={{ textAlign: "center" }} /></p>
                    <p className="pd-stitle">Punong Barangay</p>
                </div>
            </div>

            {/* Acknowledgment block — the paper 1st Endorsement omits this; it closes the monitoring gap. */}
            <div className="pd-ack">
                <h4>ACKNOWLEDGMENT (to be completed by the receiving office)</h4>
                <div className="pd-ackrow">
                    <div>Received by: <span style={{ display: "inline-block", minWidth: 180, borderBottom: "1px solid #000" }}>{endorsement?.received_by || ""}</span></div>
                    <div>Designation: <span style={{ display: "inline-block", minWidth: 140, borderBottom: "1px solid #000" }}>&nbsp;</span></div>
                    <div>Date &amp; Time: <span style={{ display: "inline-block", minWidth: 140, borderBottom: "1px solid #000" }}>{endorsement?.received_at ? fmtDate(endorsement.received_at) : ""}</span></div>
                </div>
            </div>
        </div>
    );
};

// ─── Main page ──────────────────────────────────────────────────────────────
const DOC_TYPES = {
    blotter:     { component: BlotterForm,    title: "Blotter Form",      office: "Sangguniang Barangay" },
    reklamo:     { component: ReklamoForm,    title: "Pormal na Reklamo", office: "Barangay VAW Desk" },
    "bpo-app":   { component: BpoApplication, title: "BPO Application",   office: "Barangay VAW Desk" },
    bpo:         { component: BpoOrder,       title: "Barangay Protection Order", office: "Punong Barangay" },
    endorsement: { component: Endorsement1st, title: "1st Endorsement",   office: "Punong Barangay" },
};

export default function PrintDocument() {
    const { type, caseId } = useParams();
    const navigate = useNavigate();
    const [cas, setCas] = useState(null);
    const [officials, setOfficials] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const today = todayParts();
    const [fields, setFields] = useState({
        blotterNo: "", blotterDate: fmtDate(new Date()),
        complainantName: "", complainantAddress: "",
        respondentName: "", respondentAddress: "",
        applicantName: "", applicantAddress: "",
        relationship: "", abuse: "", nature: "VAWC (RA 9262)",
        incidentWhen: "", narrative: "", consent: "",
        vawcOfficer: "", punongBarangay: "",
        toOffice: "PNP - Iba MPS (Women & Children Protection Desk)", attachedDocs: "blotter, complaint", purpose: "",
        endorseDate: fmtDate(new Date()),
        day: String(today.day), month: today.month, year: String(today.year),
        p1: true, p2: false, p3: false,
    });
    const set = (patch) => setFields(f => ({ ...f, ...patch }));

    useEffect(() => {
        Promise.all([
            api.get(`/admin/cases/${caseId}`),
            api.get(`/admin/officials`).catch(() => ({ data: { officials: [] } })),
        ]).then(([cr, or]) => {
            const c = cr.data;
            setCas(c);
            const offs = {};
            (or.data.officials || []).filter(o => o.is_active).forEach(o => { offs[o.role] = o.full_name; });
            setOfficials(offs);
            const report = (c.reports || [])[0];
            setFields(f => ({
                ...f,
                complainantName: f.complainantName || c.victim?.full_name || "",
                complainantAddress: f.complainantAddress || c.victim?.address || "",
                respondentName: f.respondentName || c.offender_name || "",
                applicantName: f.applicantName || c.applicant_name || c.victim?.full_name || "",
                applicantAddress: f.applicantAddress || c.applicant_address || c.victim?.address || "",
                relationship: f.relationship || c.relationship_to_offender_display || "",
                abuse: f.abuse || abuseText(report),
                incidentWhen: f.incidentWhen || [fmtDate(report?.incident_date), report?.address].filter(Boolean).join(" · "),
                narrative: f.narrative || report?.statement || "",
                consent: f.consent || c.applicant_consent_note || "",
                vawcOfficer: f.vawcOfficer || offs.vawc_officer || "",
                punongBarangay: f.punongBarangay || offs.punong_barangay || "",
                purpose: f.purpose || (c.endorsements || [])[0]?.purpose || "",
            }));
        }).catch(err => setError(err.response?.data?.detail || "Failed to load case."))
          .finally(() => setLoading(false));
    }, [caseId]);

    useEffect(() => {
        const prev = document.title;
        const cfg = DOC_TYPES[type];
        if (cfg && cas?.case_number) document.title = `${cfg.title} - ${cas.case_number}`.replace(/[\\/:*?"<>|]/g, "-");
        return () => { document.title = prev; };
    }, [type, cas]);

    const cfg = DOC_TYPES[type];
    if (!cfg) return <div style={{ padding: 40, textAlign: "center", fontFamily: "'Lexend',sans-serif" }}><p style={{ color: "#C62828" }}>Unknown document type: <code>{type}</code></p><button onClick={() => navigate(-1)}>Back</button></div>;
    if (loading) return <div style={{ padding: 40, textAlign: "center", fontFamily: "'Lexend',sans-serif" }}>Loading case…</div>;
    if (error)  return <div style={{ padding: 40, textAlign: "center", color: "#C62828", fontFamily: "'Lexend',sans-serif" }}>{error}</div>;
    if (!cas)   return null;

    const victim = cas.victim || {};
    const report = (cas.reports || [])[0] || null;
    const isRestricted = !!cas.restricted;
    const Doc = cfg.component;
    // Prefer the active/issued BPO for the order; the latest endorsement for the endorsement.
    const bpo = (cas.bpos || []).slice().reverse().find(b => ["issued", "served"].includes(b.status)) || (cas.bpos || [])[cas.bpos?.length - 1] || null;
    const endorsement = (cas.endorsements || [])[cas.endorsements?.length - 1] || null;

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
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><rect x="6" y="14" width="12" height="8" rx="1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            Print Document
                        </button>
                    </div>
                </div>

                {isRestricted && <div className="pd-banner"><strong>Restricted view -</strong> Sensitive fields are masked. Super Admin access is required to produce a printable official document.</div>}
                {type === "bpo" && !bpo && <div className="pd-banner">No BPO has been applied/issued for this case yet. Apply for a BPO from the case actions first.</div>}
                {type === "endorsement" && !endorsement && <div className="pd-banner">No endorsement recorded yet — this prints a blank endorsement you can fill in. Create one from the case actions to auto-fill and track acknowledgment.</div>}

                <Doc cas={cas} victim={victim} report={report} F={fields} set={set} bpo={bpo} endorsement={endorsement} />
            </div>
        </>
    );
}
