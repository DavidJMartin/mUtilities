// Drawn in a 400 x 100 viewBox stretched to fit, with a fixed "held" segment
// so the sustain level is always visible.

const WIDTH = 400;
const HEIGHT = 100;
const HOLD = 0.6; // seconds shown for the sustain plateau

export function drawEnvelope({ line, fill, labels }, { attack, decay, sustain, release }) {
    const total = attack + decay + HOLD + release;
    const x = (t) => ((t / total) * WIDTH).toFixed(1);
    const sustainY = (HEIGHT - sustain * HEIGHT).toFixed(1);

    const points = [
        [0, HEIGHT],
        [x(attack), 0],
        [x(attack + decay), sustainY],
        [x(attack + decay + HOLD), sustainY],
        [WIDTH, HEIGHT],
    ].map(p => p.join(',')).join(' ');

    line.setAttribute('points', points);
    fill.setAttribute('points', `0,${HEIGHT} ${points}`);

    // Keep each label readable even when its stage is very short
    const column = (t) => `${Math.max(0.4, (t / total) * 10).toFixed(2)}fr`;
    labels.style.gridTemplateColumns = [attack, decay, HOLD, release].map(column).join(' ');
}
