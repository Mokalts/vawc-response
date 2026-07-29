import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

if (!document.getElementById('vawc-font')) {
    const l = document.createElement('link'); l.id='vawc-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
}
if (!document.getElementById('vawc-victim-css')) {
    const s = document.createElement('style'); s.id='vawc-victim-css';
    s.textContent=`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} .vi-input{transition:border-color 0.15s,box-shadow 0.15s;} .vi-input:focus{border-color:#F47920!important;background:#fff!important;outline:none;box-shadow:0 0 0 3px rgba(244,121,32,0.1)!important;} .vi-otp{transition:all 0.15s;} .vi-otp:focus{border-color:#F47920!important;box-shadow:0 0 0 3px rgba(244,121,32,0.15)!important;outline:none;background:#fff!important;} .vi-btn{transition:all 0.15s ease;} .vi-btn:hover:not([disabled]){background:#C45E10!important;transform:translateY(-1px);}`;
    document.head.appendChild(s);
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IcoShield    = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#F47920" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoBack      = ({ c='#C45E10' }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const IcoEyeOpen   = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="12" r="3" stroke="#94A3B8" strokeWidth="1.8"/></svg>);
const IcoEyeClosed = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round"/></svg>);
const IcoWarn      = ({ c='#BE123C' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke={c} strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke={c} strokeWidth="2.4" strokeLinecap="round"/></svg>);
const IcoCheck     = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const Spinner      = () => (<span style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius: '50%',animation:'spin 0.7s linear infinite',display:'inline-block',flexShrink:0}} />);

// ─── Step indicator ───────────────────────────────────────────────────────────
const Steps = ({ current }) => (
    <div style={{display:'flex',alignItems:'center',marginBottom:24}}>
        {[1,2,3].map((n,i)=>(
            <React.Fragment key={n}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <div style={{width:28,height:28,borderRadius: 4,display:'flex',alignItems:'center',justifyContent:'center',backgroundColor:n<current?'#059669':n===current?'#F47920':'#E2E8F0',transition:'all 0.3s ease'}}>
                        {n < current
                            ? <IcoCheck />
                            : <span style={{fontSize:12,fontWeight:700,color:n===current?'#fff':'#94A3B8',fontFamily:"'DM Sans', sans-serif"}}>{n}</span>
                        }
                    </div>
                    <span style={{fontSize:10,fontWeight:600,color:n===current?'#F47920':n<current?'#059669':'#94A3B8',fontFamily:"'DM Sans', sans-serif",whiteSpace:'nowrap'}}>
                        {['Send Code','Verify','Reset'][i]}
                    </span>
                </div>
                {i<2 && <div style={{flex:1,height:2,backgroundColor:n<current?'#059669':'#E2E8F0',margin:'0 8px',marginBottom:18,transition:'background-color 0.3s ease'}} />}
            </React.Fragment>
        ))}
    </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
function ForgotPassword() {
    const navigate = useNavigate();
    const [step,            setStep]           = useState(1);
    const [usePhone,        setUsePhone]        = useState(false);
    const [identifier,      setIdentifier]      = useState('');
    const [otp,             setOtp]             = useState(['','','','','','']);
    const [newPassword,     setNewPassword]     = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword,    setShowPassword]    = useState(false);
    const [showConfirm,     setShowConfirm]     = useState(false);
    const [loading,         setLoading]         = useState(false);
    const [error,           setError]           = useState('');
    const [countdown,       setCountdown]       = useState(45);
    const [canResend,       setCanResend]       = useState(false);
    const inputs = useRef([]);

    useEffect(() => {
        if (step===2 && countdown>0) { const t=setTimeout(()=>setCountdown(c=>c-1),1000); return()=>clearTimeout(t); }
        else if (step===2 && countdown===0) setCanResend(true);
    }, [countdown,step]);

    // ── Step 1 ────────────────────────────────────────────────────────────────
    const handleSendOTP = async () => {
        if (!identifier) { setError(usePhone?"Please enter your mobile number.":"Please enter your email address."); return; }
        setLoading(true); setError('');
        try { await api.post("/auth/forgot-password/request",{identifier}); setStep(2); setCountdown(45); setCanResend(false); }
        catch (err) { setError(err.response?.data?.detail||"Account not found. Please check and try again."); }
        finally { setLoading(false); }
    };

    // ── Step 2 ────────────────────────────────────────────────────────────────
    const handleOtpChange = (val, i) => {
        if (!/^\d*$/.test(val)) return;
        const n=[...otp]; n[i]=val; setOtp(n);
        if (val && i<5) inputs.current[i+1]?.focus();
    };
    const handleOtpKey = (e, i) => { if (e.key==='Backspace' && !otp[i] && i>0) inputs.current[i-1]?.focus(); };

    const handleVerifyOTP = async () => {
        const code=otp.join("");
        if (code.length<6) { setError("Please enter the complete 6-digit code."); return; }
        setLoading(true); setError('');
        try { await api.post("/auth/forgot-password/verify-otp",{identifier,code}); setStep(3); }
        catch (err) { setError(err.response?.data?.detail||"Invalid or expired OTP. Please try again."); }
        finally { setLoading(false); }
    };

    const handleResend = async () => {
        if (!canResend) return;
        setError('');
        try { await api.post("/auth/forgot-password/request",{identifier}); setCountdown(45); setCanResend(false); setOtp(['','','','','','']); }
        catch { setError("Failed to resend OTP. Please try again."); }
    };

    // ── Step 3 ────────────────────────────────────────────────────────────────
    const handleReset = async () => {
        if (!newPassword || !confirmPassword) { setError("Please fill in both password fields."); return; }
        if (newPassword!==confirmPassword)    { setError("Passwords do not match."); return; }
        if (newPassword.length<8)             { setError("Password must be at least 8 characters."); return; }
        if (!/[A-Z]/.test(newPassword))       { setError("Password must include at least one uppercase letter."); return; }
        if (!/[0-9]/.test(newPassword))       { setError("Password must include at least one number."); return; }
        if (!/[!@#$%^&*(),.?":{}|<>_-]/.test(newPassword)) { setError("Password must include at least one special character."); return; }
        setLoading(true); setError('');
        try {
            await api.post("/auth/forgot-password/reset",{identifier,new_password:newPassword});
            navigate('/',{state:{accountCreated:false}});
        } catch (err) { setError(err.response?.data?.detail||"Failed to reset password. Please try again."); }
        finally { setLoading(false); }
    };

    const goBack = () => { if (step===1) navigate('/'); else { setStep(step-1); setError(''); } };

    return (
        <div style={S.page}>

            {/* Brand + back */}
            <div style={S.topRow}>
                <button style={S.backBtn} onClick={goBack}><IcoBack /></button>
                <div style={S.brand}>
                    <div style={S.brandIcon}><IcoShield /></div>
                    <h1 style={S.brandTitle}>
                        {step===1?"Forgot Password":step===2?"Enter OTP":"New Password"}
                    </h1>
                </div>
                <div style={{width:36}} />
            </div>

            <div style={S.card}>

                <Steps current={step} />

                {/* ── STEP 1 ── */}
                {step===1 && (
                    <>
                        <p style={S.desc}>{usePhone?"Enter your registered mobile number and we'll send a verification code.":"Enter your registered email and we'll send a 6-digit verification code."}</p>

                        <div style={S.field}>
                            <label style={S.label}>{usePhone?"Mobile Number":"Email Address"}</label>
                            <input className="vi-input" type={usePhone?"tel":"email"} placeholder={usePhone?"e.g. 09xxxxxxxxx":"Enter your email address"}
                                style={S.input} value={identifier} onChange={e=>{setIdentifier(e.target.value);setError('');}}
                                onKeyDown={e=>e.key==='Enter'&&handleSendOTP()} />
                        </div>

                        {error && <div style={S.errorBox}><IcoWarn /><p style={S.errorText}>{error}</p></div>}

                        <button className="vi-btn" style={{...S.submitBtn,opacity:loading?0.75:1}} onClick={handleSendOTP} disabled={loading}>
                            {loading?<><Spinner />Sending…</>:'Send Code'}
                        </button>

                        <p style={{textAlign:'center',fontSize:13.5,color:'#64748B',marginTop:14,fontFamily:"'DM Sans', sans-serif"}}>
                            {usePhone ? <>Use email instead?{' '}<span style={S.link} onClick={()=>{setUsePhone(false);setIdentifier('');setError('');}}>Switch to email</span></> : <>Not working?{' '}<span style={S.link} onClick={()=>{setUsePhone(true);setIdentifier('');setError('');}}>Try mobile number</span></>}
                        </p>
                    </>
                )}

                {/* ── STEP 2 ── */}
                {step===2 && (
                    <>
                        <p style={S.desc}>
                            A 6-digit code was sent to your{' '}
                            {identifier.includes("@")?"email and mobile number":"mobile number"}.
                        </p>
                        <p style={{textAlign:'center',fontSize:14.5,fontWeight:700,color:'#065F46',marginBottom:20,fontFamily:"'DM Sans', sans-serif"}}>
                            {identifier.includes("@") ? identifier.replace(/(.{2})(.*)(@.*)/, '$1***$3') : identifier.slice(0,3)+"****"+identifier.slice(-4)}
                        </p>

                        <div style={S.otpRow}>
                            {otp.map((digit,i)=>(
                                <input key={i} className="vi-otp" ref={el=>inputs.current[i]=el}
                                    type="text" maxLength={1} value={digit}
                                    onChange={e=>handleOtpChange(e.target.value,i)}
                                    onKeyDown={e=>handleOtpKey(e,i)}
                                    style={{...S.otpBox, borderColor:digit?'#F47920':'#E2E8F0', backgroundColor:digit?'#FFF0F3':'#F8FAFC'}} />
                            ))}
                        </div>

                        {error && <div style={S.errorBox}><IcoWarn /><p style={S.errorText}>{error}</p></div>}

                        <button className="vi-btn" style={{...S.submitBtn,opacity:loading?0.75:1}} onClick={handleVerifyOTP} disabled={loading}>
                            {loading?<><Spinner />Verifying…</>:'Verify Code'}
                        </button>

                        <p style={{textAlign:'center',fontSize:14,color:'#64748B',marginTop:16,fontFamily:"'DM Sans', sans-serif"}}>
                            Didn't receive a code?{' '}
                            {canResend ? <span style={S.link} onClick={handleResend}>Resend Code</span>
                                       : <span style={{color:'#CBD5E1',fontWeight:600,fontFamily:"'DM Sans', sans-serif"}}>Resend in 0:{countdown<10?`0${countdown}`:countdown}</span>}
                        </p>
                    </>
                )}

                {/* ── STEP 3 ── */}
                {step===3 && (
                    <>
                        <p style={S.desc}>Enter your new password below. Make sure it meets all the requirements.</p>

                        <div style={S.field}>
                            <label style={S.label}>New Password</label>
                            <div style={S.pwWrap}>
                                <input className="vi-input" type={showPassword?'text':'password'} placeholder="Enter new password"
                                    value={newPassword} onChange={e=>setNewPassword(e.target.value)}
                                    style={{...S.pwInput,border:'none',boxShadow:'none'}} />
                                <button type="button" style={S.eyeBtn} onClick={()=>setShowPassword(v=>!v)}>
                                    {showPassword?<IcoEyeClosed />:<IcoEyeOpen />}
                                </button>
                            </div>
                        </div>

                        <div style={S.field}>
                            <label style={S.label}>Confirm New Password</label>
                            <div style={S.pwWrap}>
                                <input className="vi-input" type={showConfirm?'text':'password'} placeholder="Confirm new password"
                                    value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}
                                    style={{...S.pwInput,border:'none',boxShadow:'none'}} />
                                <button type="button" style={S.eyeBtn} onClick={()=>setShowConfirm(v=>!v)}>
                                    {showConfirm?<IcoEyeClosed />:<IcoEyeOpen />}
                                </button>
                            </div>
                            {confirmPassword.length>0 && newPassword!==confirmPassword && (
                                <p style={{fontSize:12,color:'#F47920',marginTop:6,marginBottom:0,fontFamily:"'DM Sans', sans-serif"}}>Passwords do not match.</p>
                            )}
                        </div>

                        {error && <div style={S.errorBox}><IcoWarn /><p style={S.errorText}>{error}</p></div>}

                        <button className="vi-btn" style={{...S.submitBtn,opacity:loading?0.75:1}} onClick={handleReset} disabled={loading}>
                            {loading?<><Spinner />Resetting…</>:'Reset Password'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

const S = {
    page:       {minHeight:'100vh',backgroundColor:'#FFF3E0',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:"'DM Sans', sans-serif"},
    topRow:     {display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',maxWidth:420,marginBottom:20},
    backBtn:    {width:36,height:36,borderRadius: 10,backgroundColor:'#fff',border:'1px solid #FFE4CC',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0},
    brand:      {display:'flex',alignItems:'center',gap:10,flex:1,justifyContent:'center'},
    brandIcon:  {width:34,height:34,borderRadius: '50%',backgroundColor:'#FFF3E0',border:'1px solid #FFE4CC',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0},
    brandTitle: {fontSize:16,fontWeight:800,color:'#C45E10',margin:0,fontFamily:"'DM Sans', sans-serif"},
    card:       {backgroundColor:'#fff',borderRadius: 12,padding:'24px',width:'100%',maxWidth:420,boxShadow:'0 4px 20px rgba(244,121,32,0.08)',border:'1px solid #FFE4CC'},
    desc:       {fontSize:13.5,color:'#64748B',lineHeight:1.6,marginBottom:20,textAlign:'center',fontFamily:"'DM Sans', sans-serif"},
    field:      {marginBottom:16},
    label:      {display:'block',fontSize:11,fontWeight:700,color:'#C45E10',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.07em',fontFamily:"'DM Sans', sans-serif"},
    input:      {width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius: 8,border:'1.5px solid #E2E8F0',fontSize:15,color:'#0F172A',backgroundColor:'#F8FAFC',outline:'none',fontFamily:"'DM Sans', sans-serif"},
    pwWrap:     {display:'flex',alignItems:'center',border:'1.5px solid #E2E8F0',borderRadius: 8,backgroundColor:'#F8FAFC',overflow:'hidden'},
    pwInput:    {flex:1,padding:'12px 14px',border:'none',fontSize:15,color:'#0F172A',backgroundColor:'transparent',outline:'none',fontFamily:"'DM Sans', sans-serif"},
    eyeBtn:     {padding:'0 13px',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',flexShrink:0},
    otpRow:     {display:'flex',justifyContent:'space-between',gap:8,marginBottom:18},
    otpBox:     {width:'100%',maxWidth:52,height:58,borderRadius: 4,border:'2px solid #E2E8F0',fontSize:22,fontWeight:700,textAlign:'center',color:'#C45E10',outline:'none',fontFamily:"'DM Sans', sans-serif"},
    errorBox:   {display:'flex',alignItems:'center',gap:8,backgroundColor:'#FFF1F2',border:'1px solid #FECDD3',borderRadius: 8,padding:'10px 13px',marginBottom:16,animation:'fadeUp 0.2s ease'},
    errorText:  {margin:0,fontSize:13,color:'#BE123C',fontFamily:"'DM Sans', sans-serif"},
    submitBtn:  {width:'100%',padding:13,backgroundColor:'#F47920',color:'#fff',fontSize:15,fontWeight:600,border:'none',borderRadius: 8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:"'DM Sans', sans-serif",boxShadow:'0 2px 8px rgba(244,121,32,0.25)'},
    link:       {color:'#1FA87A',fontWeight:600,cursor:'pointer',fontFamily:"'DM Sans', sans-serif"},
};

export default ForgotPassword;
