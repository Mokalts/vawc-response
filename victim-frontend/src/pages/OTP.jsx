import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from "../api";

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id='vawc-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-victim-css')) {
    const s = document.createElement('style'); s.id='vawc-victim-css';
    s.textContent=`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} .vi-otp{transition:all 0.15s;} .vi-otp:focus{border-color:#F47920!important;box-shadow:0 0 0 3px rgba(244,121,32,0.15)!important;outline:none;background:#fff!important;} .vi-btn{transition:all 0.15s ease;} .vi-btn:hover:not([disabled]){background:#C45E10!important;transform:translateY(-1px);}`;
    document.head.appendChild(s);
}

const IcoShield = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#F47920" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoInfo   = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#0369A1" strokeWidth="1.8"/><line x1="12" y1="16" x2="12" y2="12" stroke="#0369A1" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="8" x2="12.01" y2="8" stroke="#0369A1" strokeWidth="2.4" strokeLinecap="round"/></svg>);
const IcoWarn   = ({ c='#92400E' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke={c} strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke={c} strokeWidth="2.4" strokeLinecap="round"/></svg>);
const IcoCheck  = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoPhone  = ({ c='#475569' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Spinner   = () => (<span style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius: '50%',animation:'spin 0.7s linear infinite',display:'inline-block',flexShrink:0}} />);

function OTP() {
    const navigate = useNavigate();
    const location = useLocation();
    const isPending = location.state?.pendingVerification || false;

    const [otp,           setOtp]           = useState(['','','','','','']);
    const [countdown,     setCountdown]     = useState(45);
    const [canResend,     setCanResend]     = useState(false);
    const [loading,       setLoading]       = useState(false);
    const [channel,       setChannel]       = useState('email');
    const [switchLoading, setSwitchLoading] = useState(false);
    const [error,         setError]         = useState('');
    const [resendSuccess, setResendSuccess] = useState(false);
    const inputs = useRef([]);

    const phone = localStorage.getItem("pending_phone") || "";
    const email = localStorage.getItem("pending_email") || "";
    const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    const maskedPhone = phone.length >= 7 ? phone.slice(0,3)+"****"+phone.slice(-4) : phone;

    useEffect(() => {
        if (countdown > 0) { const t = setTimeout(()=>setCountdown(c=>c-1),1000); return ()=>clearTimeout(t); }
        else setCanResend(true);
    }, [countdown]);

    const handleChange = (val, i) => {
        if (!/^\d*$/.test(val)) return;
        const n=[...otp]; n[i]=val; setOtp(n);
        if (val && i<5) inputs.current[i+1]?.focus();
    };
    const handleKeyDown = (e, i) => { if (e.key==='Backspace' && !otp[i] && i>0) inputs.current[i-1]?.focus(); };

    const handleSwitch = async () => {
        if (channel==='phone') return;
        setSwitchLoading(true); setError(''); setResendSuccess(false);
        try { await api.post("/auth/otp/send",{phone_number:phone}); setChannel('phone'); setOtp(['','','','','','']); setCountdown(45); setCanResend(false); }
        catch { setError("Failed to send code to mobile. Please try again."); }
        finally { setSwitchLoading(false); }
    };

    const handleResend = async () => {
        if (!canResend) return;
        setError(''); setResendSuccess(false);
        try {
            if (channel==='email') await api.post("/auth/otp/send-email",{phone_number:phone});
            else                   await api.post("/auth/otp/send",{phone_number:phone});
            setCountdown(45); setCanResend(false); setOtp(['','','','','','']); setResendSuccess(true);
        } catch { setError("Failed to resend OTP. Please try again."); }
    };

    const handleVerify = async () => {
        const code = otp.join("");
        if (code.length<6) { setError("Please enter the complete 6-digit code."); return; }
        setLoading(true); setError('');
        try {
            const res = await api.post("/auth/otp/verify",{phone_number:phone,code});
            localStorage.setItem("token",res.data.access_token);
            localStorage.removeItem("pending_phone"); localStorage.removeItem("pending_email");
            navigate('/',{state:{accountCreated:true}});
        } catch (err) { setError(err.response?.data?.detail||"Invalid or expired OTP."); }
        finally { setLoading(false); }
    };

    return (
        <div style={S.page}>
            <div style={S.brand}>
                <div style={S.brandIcon}><IcoShield /></div>
                <div>
                    <h1 style={S.brandTitle}>Verify Your Account</h1>
                    <p style={S.brandSub}>
                        {channel==='email' ? <>Code sent to <strong style={{color:'#065F46'}}>{maskedEmail}</strong></> : <>Code sent to <strong style={{color:'#065F46'}}>{maskedPhone}</strong></>}
                    </p>
                </div>
            </div>

            {isPending && (
                <div style={{...S.banner, backgroundColor:'#FFFBEB', borderColor:'#FDE68A', maxWidth:420, width:'100%', marginBottom:14}}>
                    <IcoWarn />
                    <div>
                        <p style={S.bannerTitle}>Your previous code may have expired</p>
                        <p style={S.bannerText}>Please request a new code using the <strong>Resend</strong> button below.</p>
                    </div>
                </div>
            )}

            <div style={S.card}>
                {/* Instructions */}
                <div style={S.instructBox}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:9}}>
                        <IcoInfo />
                        <p style={{margin:0,fontSize:12.5,fontWeight:700,color:'#0369A1',fontFamily:"'DM Sans', sans-serif"}}>How to verify</p>
                    </div>
                    <ul style={{margin:0,paddingLeft:16,display:'flex',flexDirection:'column',gap:4}}>
                        {[
                            `Enter the 6-digit code sent to your ${channel==='email'?'email':'mobile number'}.`,
                            'Code expires in 5 minutes - use Resend if needed.',
                            'A verification link was also emailed - valid for 1 hour.',
                            "Can't find the email? Check your spam folder.",
                        ].map((t,i)=><li key={i} style={{fontSize:12.5,color:'#0369A1',lineHeight:1.6,fontFamily:"'DM Sans', sans-serif"}}>{t}</li>)}
                    </ul>
                </div>

                {/* OTP boxes */}
                <div style={S.otpRow}>
                    {otp.map((digit,i)=>(
                        <input key={i} className="vi-otp" ref={el=>inputs.current[i]=el}
                            type="text" maxLength={1} value={digit}
                            onChange={e=>handleChange(e.target.value,i)}
                            onKeyDown={e=>handleKeyDown(e,i)}
                            style={{...S.otpBox, borderColor:digit?'#F47920':'#E2E8F0', backgroundColor:digit?'#FFF0F3':'#F8FAFC'}} />
                    ))}
                </div>

                {error && (
                    <div style={{display:'flex',alignItems:'center',gap:8,backgroundColor:'#FFF1F2',border:'1px solid #FECDD3',borderRadius: 4,padding:'10px 13px',marginBottom:14,animation:'fadeUp 0.2s ease'}}>
                        <IcoWarn c="#BE123C" />
                        <p style={{margin:0,fontSize:13,color:'#BE123C',fontFamily:"'DM Sans', sans-serif"}}>{error}</p>
                    </div>
                )}
                {resendSuccess && (
                    <div style={{display:'flex',alignItems:'center',gap:8,backgroundColor:'#ECFDF5',border:'1px solid #A7F3D0',borderRadius: 4,padding:'10px 13px',marginBottom:14,animation:'fadeUp 0.2s ease'}}>
                        <IcoCheck />
                        <p style={{margin:0,fontSize:13,color:'#065F46',fontFamily:"'DM Sans', sans-serif"}}>New code sent. Check your {channel==='email'?'email (and spam folder)':'mobile number'}.</p>
                    </div>
                )}

                <button className="vi-btn" style={{...S.verifyBtn,opacity:loading?0.75:1}} onClick={handleVerify} disabled={loading}>
                    {loading?<><Spinner /> Verifying…</>:'Verify Account'}
                </button>

                <div style={S.divider} />

                <p style={{textAlign:'center',fontSize:14,color:'#64748B',marginBottom:channel==='email'?14:0,fontFamily:"'DM Sans', sans-serif"}}>
                    Didn't receive a code?{' '}
                    {canResend
                        ? <span style={S.link} onClick={handleResend}>Resend Code</span>
                        : <span style={{color:'#CBD5E1',fontWeight:600,fontFamily:"'DM Sans', sans-serif"}}>Resend in 0:{countdown<10?`0${countdown}`:countdown}</span>
                    }
                </p>

                {channel==='email' && (
                    <button style={{...S.switchBtn,opacity:switchLoading?0.7:1}} onClick={handleSwitch} disabled={switchLoading}>
                        <IcoPhone />
                        {switchLoading?"Sending to mobile…":"Send code to mobile number instead"}
                    </button>
                )}
                {channel==='phone' && (
                    <p style={{textAlign:'center',fontSize:13.5,color:'#64748B',fontFamily:"'DM Sans', sans-serif"}}>
                        Wrong number?{' '}
                        <span style={S.link} onClick={()=>{setChannel('email');setOtp(['','','','','','']);setCountdown(45);setCanResend(false);setError('');setResendSuccess(false);}}>Use email instead</span>
                    </p>
                )}
            </div>
        </div>
    );
}

const S = {
    page:       {minHeight:'100vh',backgroundColor:'#FFF3E0',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:"'DM Sans', sans-serif"},
    brand:      {display:'flex',alignItems:'center',gap:14,marginBottom:16,width:'100%',maxWidth:420},
    brandIcon:  {width:44,height:44,borderRadius: '50%',backgroundColor:'#fff',border:'1px solid #FFE4CC',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 2px 8px rgba(244,121,32,0.1)'},
    brandTitle: {fontSize:18,fontWeight:800,color:'#C45E10',margin:'0 0 3px',fontFamily:"'DM Sans', sans-serif"},
    brandSub:   {fontSize:13,color:'#475569',margin:0,fontFamily:"'DM Sans', sans-serif"},
    banner:     {display:'flex',alignItems:'flex-start',gap:10,borderRadius: 4,padding:'13px 15px',border:'1.5px solid',boxSizing:'border-box'},
    bannerTitle:{fontSize:13.5,fontWeight:700,color:'#92400E',margin:'0 0 3px',fontFamily:"'DM Sans', sans-serif"},
    bannerText: {fontSize:12.5,color:'#78350F',margin:0,lineHeight:1.5,fontFamily:"'DM Sans', sans-serif"},
    card:       {backgroundColor:'#fff',borderRadius: 12,padding:'24px',width:'100%',maxWidth:420,boxShadow:'0 4px 20px rgba(244,121,32,0.08)',border:'1px solid #FFE4CC'},
    instructBox:{backgroundColor:'#F3E5F5',border:'1.5px solid #BFDBFE',borderRadius: 12,padding:'13px 15px',marginBottom:20},
    otpRow:     {display:'flex',justifyContent:'space-between',gap:8,marginBottom:18},
    otpBox:     {width:'100%',maxWidth:56,height:60,borderRadius: 4,border:'2px solid #E2E8F0',fontSize:22,fontWeight:700,textAlign:'center',color:'#C45E10',outline:'none',fontFamily:"'DM Sans', sans-serif"},
    verifyBtn:  {width:'100%',padding:13,backgroundColor:'#F47920',color:'#fff',fontSize:15,fontWeight:600,border:'none',borderRadius: 4,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:"'DM Sans', sans-serif",boxShadow:'0 2px 8px rgba(244,121,32,0.25)'},
    divider:    {height:1,backgroundColor:'#F1F5F9',margin:'18px 0'},
    link:       {color:'#F47920',fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans', sans-serif"},
    switchBtn:  {width:'100%',padding:'11px 14px',backgroundColor:'#F8FAFC',color:'#475569',fontSize:13.5,fontWeight:600,border:'1.5px solid #E2E8F0',borderRadius: 4,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:"'DM Sans', sans-serif",marginTop:8},
};

export default OTP;
