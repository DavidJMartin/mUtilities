// Chord box as inline SVG: strings run vertically (low E on the left), frets
// horizontally. Dots show each note's role in the chord (R, 3, 5, ♭7...).
// Colours come from CSS classes so the diagram follows the theme.

const SVG_NS = 'http://www.w3.org/2000/svg';
const STRING_GAP = 16;
const FRET_GAP = 20;
const FRETS_SHOWN = 5;
const LEFT = 32;
const TOP = 22;
const WIDTH = LEFT + STRING_GAP * 5 + 20;
const HEIGHT = TOP + FRET_GAP * FRETS_SHOWN + 8;

function svg(tag, attrs = {}, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
}

/**
 * @param {{frets: (number|null)[], labels: (string|null)[], baseFret: number,
 *          barre: {fret: number, from: number, to: number}|null}} voicing
 * @param {string} label  accessible description, e.g. 'C major, x32010'
 */
export function createChordDiagram(voicing, label) {
    const { frets, labels, baseFret, barre } = voicing;
    const root = svg('svg', { class: 'chord-diagram', viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: 'img', 'aria-label': label });
    const x = (string) => LEFT + string * STRING_GAP;
    const y = (fret) => TOP + (fret - baseFret + 0.5) * FRET_GAP;

    for (let f = 0; f <= FRETS_SHOWN; f++) {
        const isNut = f === 0 && baseFret === 1;
        root.append(svg('line', {
            class: isNut ? 'chord-diagram__nut' : 'chord-diagram__fret',
            x1: x(0), x2: x(5), y1: TOP + f * FRET_GAP, y2: TOP + f * FRET_GAP,
        }));
    }
    for (let s = 0; s < 6; s++) {
        root.append(svg('line', { class: 'chord-diagram__string', x1: x(s), x2: x(s), y1: TOP, y2: TOP + FRETS_SHOWN * FRET_GAP }));
    }

    if (baseFret > 1) {
        root.append(svg('text', { class: 'chord-diagram__position', x: LEFT - 8, y: y(baseFret) + 3, 'text-anchor': 'end' }, `${baseFret}fr`));
    }

    if (barre) {
        root.append(svg('rect', {
            class: 'chord-diagram__barre',
            x: x(barre.from) - 7, y: y(barre.fret) - 7,
            width: x(barre.to) - x(barre.from) + 14, height: 14, rx: 7,
        }));
    }

    frets.forEach((fret, s) => {
        if (fret === null || fret === 0) {
            root.append(svg('text', { class: 'chord-diagram__open', x: x(s), y: TOP - 8, 'text-anchor': 'middle' }, fret === null ? '×' : '○'));
            return;
        }
        const isRoot = labels[s] === '1';
        root.append(svg('circle', { class: isRoot ? 'chord-diagram__dot chord-diagram__dot--root' : 'chord-diagram__dot', cx: x(s), cy: y(fret), r: 7 }));
        root.append(svg('text', { class: 'chord-diagram__tone', x: x(s), y: y(fret) + 2.5, 'text-anchor': 'middle' }, isRoot ? 'R' : labels[s]));
    });

    return root;
}
