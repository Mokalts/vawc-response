/**
 * Filling a row of single-digit code boxes from one pasted string.
 *
 * Each box is maxLength=1, so a pasted "123456" put "1" in the box she pasted
 * into and silently dropped the other five digits. Nobody retypes a code they
 * can copy, so this was most paste attempts failing.
 *
 * Shared by the registration OTP screen and the password-reset screen, which
 * had identical copies of the same handlers.
 */

/**
 * Spread `text` across the boxes and move focus to where she would type next.
 *
 * Only digits are kept, so the code still lands correctly when it is copied
 * with surrounding spaces, a dash, or a whole sentence of the email around it.
 * A full-length code always fills from the first box: pasting six digits into
 * box three and filling from there would drop the last two.
 *
 * Returns false when there was nothing usable, so the caller can let the
 * browser handle the event normally.
 */
export function spreadCode(text, startIndex, current, setOtp, inputsRef) {
    const digits = String(text || '').replace(/\D/g, '');
    if (!digits) return false;

    const next = [...current];
    let i = digits.length >= next.length ? 0 : startIndex;
    for (const d of digits) {
        if (i >= next.length) break;
        next[i++] = d;
    }
    setOtp(next);

    // Carry on from the box after the last one filled, not from the first box
    // that happens to be empty: pasting two digits into box four should leave
    // her at box six, not send her back to the start of the row.
    const target = Math.min(i, next.length - 1);
    // After the state change, or the focus lands on the pre-paste render. A
    // timer rather than requestAnimationFrame, which browsers suspend while the
    // tab is in the background and which therefore never moved the caret at all.
    setTimeout(() => inputsRef.current[target]?.focus(), 0);
    return true;
}
