/**
 * The camera guide drawn over the face-scan video, shared by FaceVerify and
 * FaceEnroll so both screens teach the same thing.
 *
 * It is a head-and-shoulders silhouette, not a bare oval. An oval tells you
 * where your face goes but not how far away to stand or how to hold your
 * shoulders, so people lean in until the frame is all forehead — which is
 * exactly the framing the detector handles worst.
 *
 * The dimmed area is punched out with `destination-out` rather than an even-odd
 * fill: the head and the shoulders overlap at the neck, and even-odd would XOR
 * that overlap back into the dim layer, leaving a notch across the throat.
 *
 * No text is drawn on the canvas. Canvas text ignores the page's font scaling
 * and is invisible to screen readers, so every instruction lives in the DOM
 * status band beside it.
 */

// state → outline colour. Anything unknown falls back to the neutral guide.
const STATE_COLOR = {
    idle:      'rgba(255,255,255,0.78)',
    searching: 'rgba(255,255,255,0.78)',
    ok:        '#10B981',   // one face, well placed
    multi:     '#F59E0B',   // more than one face in frame
    busy:      '#F47920',   // capturing / verifying
};

export function drawFaceGuide(canvas, state = 'idle') {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2;

    // Head sits above centre so the neck and shoulders have the lower third.
    const headCy = h * 0.36;
    const headRx = w * 0.175;
    const headRy = h * 0.235;
    const shoulderY = headCy + headRy * 1.30;   // top of the shoulder line
    const neckHalf = headRx * 0.46;
    const neckTop = headCy + headRy * 0.70;     // where the neck meets the jaw

    const head = (c) => {
        c.beginPath();
        c.ellipse(cx, headCy, headRx, headRy, 0, 0, Math.PI * 2);
    };
    // Shoulders WITH a neck: a bare arc under a circle reads as two unrelated
    // shapes, and people line their chin up with the arc instead of standing
    // back. The neck is what makes it a person.
    const body = (c) => {
        c.beginPath();
        c.moveTo(cx - w * 0.40, h);
        c.quadraticCurveTo(cx - w * 0.37, shoulderY + h * 0.02, cx - w * 0.19, shoulderY);
        c.quadraticCurveTo(cx - neckHalf * 1.7, shoulderY - h * 0.035, cx - neckHalf, neckTop);
        c.lineTo(cx + neckHalf, neckTop);
        c.quadraticCurveTo(cx + neckHalf * 1.7, shoulderY - h * 0.035, cx + w * 0.19, shoulderY);
        c.quadraticCurveTo(cx + w * 0.37, shoulderY + h * 0.02, cx + w * 0.40, h);
        c.closePath();
    };

    ctx.clearRect(0, 0, w, h);

    // Dim everything, then clear the silhouette back out of it.
    ctx.save();
    ctx.fillStyle = 'rgba(10,8,7,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    head(ctx); ctx.fill();
    body(ctx); ctx.fill();
    ctx.restore();

    // Outline. Dashed while we are still looking for a face, solid once the
    // frame is right, so the change is visible without reading anything.
    const color = STATE_COLOR[state] || STATE_COLOR.idle;
    const dash = state === 'ok' ? [] : [9, 6];

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = state === 'ok' ? 3 : 2.5;
    ctx.setLineDash(dash);
    body(ctx); ctx.stroke();

    // The neck sides run up behind the jaw, so erase whatever of that stroke
    // landed inside the head before drawing the head itself on top.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.setLineDash([]);
    head(ctx); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = state === 'ok' ? 3 : 2.5;
    ctx.setLineDash(dash);
    head(ctx); ctx.stroke();
    ctx.restore();

    // Corner ticks around the head, the part that actually has to be in frame.
    const t = Math.min(w, h) * 0.045;
    const bx = headRx * 1.35, by = headRy * 1.2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        const x = cx + sx * bx, y = headCy + sy * by;
        ctx.beginPath();
        ctx.moveTo(x - sx * t, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y - sy * t);
        ctx.stroke();
    });
    ctx.restore();
}

/** Maps what the detector saw to a guide state. */
export function guideStateForCount(count, busy = false) {
    if (busy) return 'busy';
    if (count === 1) return 'ok';
    if (count > 1) return 'multi';
    return 'searching';
}
