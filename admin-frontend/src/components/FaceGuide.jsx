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
    adjust:    '#F59E0B',   // seen, but not in the outline yet
    ok:        '#10B981',   // one face, actually inside the guide
    multi:     '#EF4444',   // more than one face in frame
    busy:      '#F47920',   // capturing / verifying
};

// The guide's head target, as fractions of the frame. drawFaceGuide draws with
// these and evaluateFraming measures against them, so the outline and the words
// can never disagree about where the face is supposed to be.
export const GUIDE = {
    cx: 0.5,
    cy: 0.36,
    rx: 0.175,
    ry: 0.235,
    frameAspect: 4 / 3,     // the camera box is 4:3 (see FaceVerify styles)
};

// How far off before we say something. Detection boxes cover the face, roughly
// four fifths of the head the outline describes, hence the height band.
export const FRAMING = {
    minHeight: 0.26,
    maxHeight: 0.54,
    tolX: 0.11,
    tolY: 0.12,
};

export function drawFaceGuide(canvas, state = 'idle') {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2;

    // Head sits above centre so the neck and shoulders have the lower third.
    const headCy = h * GUIDE.cy;
    const headRx = w * GUIDE.rx;
    const headRy = h * GUIDE.ry;
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

/**
 * Where the detected face actually sits, relative to the guide.
 *
 * Two conversions have to happen before the numbers mean anything:
 *
 *  1. CROP. The video is `object-fit: cover` inside a 4:3 box, so a 16:9 camera
 *     has its sides cut off on screen. Detection coordinates are in the full
 *     camera frame, including the part nobody can see.
 *  2. MIRROR. The preview is flipped (`scaleX(-1)`) so it behaves like a mirror.
 *     Move right and your image moves right, so a hint is only correct if it is
 *     phrased against the flipped image.
 *
 * Returns one of: ok | far | near | left | right | up | down.
 * Distance is judged first: there is no point nudging someone sideways when
 * they are too far away for any of it to matter.
 */
export function evaluateFraming(box, videoWidth, videoHeight) {
    if (!box || !videoWidth || !videoHeight) return { state: 'searching' };

    const videoAspect = videoWidth / videoHeight;
    let visX = 1, visY = 1;
    if (videoAspect > GUIDE.frameAspect) visX = GUIDE.frameAspect / videoAspect;  // sides cropped
    else                                 visY = videoAspect / GUIDE.frameAspect;  // top/bottom cropped

    const rawX = (box.x + box.width / 2) / videoWidth;
    const rawY = (box.y + box.height / 2) / videoHeight;

    // Into visible-frame fractions, then mirrored for the flipped preview.
    const dx = 1 - (rawX - (1 - visX) / 2) / visX;
    const dy = (rawY - (1 - visY) / 2) / visY;
    const dh = (box.height / videoHeight) / visY;

    let state = 'ok';
    if (dh < FRAMING.minHeight)      state = 'far';
    else if (dh > FRAMING.maxHeight) state = 'near';
    else if (dx < GUIDE.cx - FRAMING.tolX) state = 'right';  // face sits left → move right
    else if (dx > GUIDE.cx + FRAMING.tolX) state = 'left';
    else if (dy < GUIDE.cy - FRAMING.tolY) state = 'down';   // face sits high → move down
    else if (dy > GUIDE.cy + FRAMING.tolY) state = 'up';

    return { state, dx, dy, dh };
}

/** Outline colour state from the detector's face count plus framing. */
export function guideState(count, framing, busy = false) {
    if (busy) return 'busy';
    if (count === 0) return 'searching';
    if (count > 1) return 'multi';
    return framing && framing.state === 'ok' ? 'ok' : 'adjust';
}
