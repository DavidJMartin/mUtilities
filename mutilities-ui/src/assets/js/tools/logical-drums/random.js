// A tamed randomiser. Fully random settings mostly give mush (×16 buzzes,
// three-gate chains that never fire, kicks that never land on the one), but
// too much taming gives a rigid grid, so the rules aim at the dull cases
// rather than squeezing everything:
//
// 1. Generators come from a weighted palette: no ×6 and up, lots of Euclid
//    (odd step counts give polymeters), most signals shifted, gates as slow
//    masks, and no two generators the same.
// 2. Chains lean towards logic: one signal is the least likely length.
// 3. Each drum has a role with a loose density range (hits per bar). The kick
//    lands on beat 1; the snare often has a backbeat and mostly avoids the kick.
// 4. Perfectly regular fast pulses (four on the floor, snare on every "and")
//    are only allowed now and then, and no two drums may play identical hits.
//
// Everything is checked with the same rowFires() that plays and exports, so
// what passes is exactly what you hear. Pass rng to make it repeatable.
//
// Locks: locked generators and rows keep their settings exactly. New rows are
// still checked against the locked ones (no doubling a locked kick), and a
// locked row is never judged against its role: it's yours.

import { ACCENT_ROW, DRUM, DRUM_COUNT, TICKS_PER_BAR, clampGenerator, rowFires, shiftMax } from './logic.js';

const CHECK_BARS = 4;
const CHECK_TICKS = CHECK_BARS * TICKS_PER_BAR;

// Rate weights: dividers and ×1–×4 only. ×6, ×8, ×12 and ×16 are left out.
const RATE_WEIGHTS = [[-4, 1.2], [-3, 0.9], [-2, 1.4], [1, 1.1], [2, 1.4], [3, 1], [4, 1.2]];
const EUCLID_CHANCE = 0.45;
const EUCLID_STEPS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 16];
const SHIFT_CHANCE = 0.75;
const GATE_CHANCE = 0.35;

// Two signals is the most likely chain; plenty of three
const CHAIN_WEIGHTS = [[1, 0.3], [2, 0.45], [3, 0.25]];
const GATE_WEIGHTS = [['ANDNOT', 0.3], ['OR', 0.25], ['AND', 0.25], ['XOR', 0.2]];

// A hit every beat or faster, perfectly evenly spaced. Allowed now and then.
const FAST_REGULAR_TICKS = 48;

// One role per row, in row order (drums, then accent).
// chance = how often the drum plays at all; min/max = hits per bar (for the
// accent, how often it switches on); avoid = row it mostly mustn't double;
// regular = chance a perfectly even, beat-or-faster pulse is acceptable;
// backbeat = chance it must hit beat 2 or 4 somewhere.
const ROLES = [
    /* kick */ { chance: 1, min: 1, max: 6, downbeat: true, regular: 0.15 },
    /* snare */ { chance: 1, min: 0.75, max: 5, avoid: DRUM.kick, noDownbeat: true, regular: 0.05, backbeat: 0.55 },
    // The clap may layer with the snare (a classic move); only identical rows are ruled out
    /* clap */ { chance: 0.5, min: 0.75, max: 4, noDownbeat: true, regular: 0.05, backbeat: 0.35 },
    /* low tom */ { chance: 0.4, min: 0.5, max: 4, avoid: DRUM.kick, regular: 0.2 },
    /* high tom */ { chance: 0.4, min: 0.5, max: 4, avoid: DRUM.lowTom, regular: 0.2 },
    /* closed hat */ { chance: 1, min: 2, max: 16, regular: 0.5 },
    /* open hat */ { chance: 0.6, min: 0.5, max: 5, avoid: DRUM.closedHat, regular: 0.25 },
    /* rim */ { chance: 0.55, min: 0.75, max: 7, regular: 0.25 },
    /* accent */ { chance: 0.55, min: 0.5, max: 4, regular: 0.5 },
];
const KIT_MAX_PER_BAR = 44;
const ROW_ATTEMPTS = 150;
const PATCH_ATTEMPTS = 40;

const pick = (rng, items) => items[Math.floor(rng() * items.length)];
const chance = (rng, p) => rng() < p;

function weighted(rng, pairs) {
    const total = pairs.reduce((sum, [, w]) => sum + w, 0);
    let roll = rng() * total;
    for (const [value, w] of pairs) {
        roll -= w;
        if (roll < 0) return value;
    }
    return pairs[pairs.length - 1][0];
}

function randomGenerator(rng) {
    if (chance(rng, EUCLID_CHANCE)) {
        const n = pick(rng, EUCLID_STEPS);
        const lo = Math.max(1, Math.round(n * 0.2));
        const hi = Math.max(lo, Math.round(n * 0.65));
        const k = lo + Math.floor(rng() * (hi - lo + 1));
        return clampGenerator({ type: 'euclid', rate: 1, mode: 'trig', n, k, shift: Math.floor(rng() * n) });
    }

    const rate = weighted(rng, RATE_WEIGHTS);
    // Gates only make sense as slow masks, so only on ×1 and slower
    const mode = rate <= 1 && chance(rng, GATE_CHANCE) ? 'gate' : 'trig';
    const g = { type: 'md', rate, mode, k: 3, n: 8, shift: 0 };
    // Mostly shifted, anywhere in the cycle, so pulses don't all start on the one
    if (chance(rng, SHIFT_CHANCE)) g.shift = Math.floor(rng() * (shiftMax(g) + 1));
    return clampGenerator(g);
}

const genKey = g => JSON.stringify([g.type, g.rate, g.mode, g.shift, g.type === 'euclid' ? [g.k, g.n] : 0]);

/** Six generators, no two with the same settings; locked ones (keep[i] set) stay as they are */
function uniqueGenerators(rng, keep = []) {
    const gens = keep.slice(0, 6);
    const seen = new Set(gens.filter(Boolean).map(genKey));
    for (let i = 0; i < 6; i++) {
        if (gens[i]) continue;
        let g;
        do g = randomGenerator(rng); while (seen.has(genKey(g)));
        seen.add(genKey(g));
        gens[i] = g;
    }
    return gens;
}

/** Hit ticks for a row over the check window */
function hitsOf(gens, row) {
    const hits = [];
    for (let t = 0; t < CHECK_TICKS; t++) {
        if (rowFires(gens, row, t)) hits.push(t);
    }
    return hits;
}

function randomChain(rng, length) {
    const order = [0, 1, 2, 3, 4, 5].sort(() => rng() - 0.5);
    const sigs = order.slice(0, length);
    const gates = sigs.slice(1).map(() => weighted(rng, GATE_WEIGHTS));
    return { sigs, gates };
}

const isFastRegular = (hits) => {
    if (hits.length < 3) return false;
    const gap = hits[1] - hits[0];
    return gap <= FAST_REGULAR_TICKS && hits.every((t, i) => i === 0 || t - hits[i - 1] === gap);
};

const hasBackbeat = hits => hits.some(t => t % TICKS_PER_BAR === 48 || t % TICKS_PER_BAR === 144);

/** rules: per-attempt dice already rolled for this row (regular allowed, backbeat needed) */
function fitsRole(role, rules, hits, others) {
    const perBar = hits.length / CHECK_BARS;
    if (perBar < role.min || perBar > role.max) return false;
    if (role.downbeat && hits[0] !== 0) return false;
    if (role.noDownbeat && hits.includes(0)) return false;
    if (!rules.regular && isFastRegular(hits)) return false;
    if (rules.backbeat && !hasBackbeat(hits)) return false;
    // No two drums playing exactly the same hits
    const key = hits.join();
    if (others.some(h => h?.length && h.join() === key)) return false;
    if (role.avoid !== undefined) {
        // Allow a little overlap but not mostly doubling another drum
        const other = new Set(others[role.avoid] ?? []);
        const clashes = hits.filter(t => other.has(t)).length;
        if (clashes > hits.length * 0.25) return false;
    }
    return true;
}

function randomRow(rng, gens, index, others) {
    const role = ROLES[index];
    if (!chance(rng, role.chance)) return null;

    const strict = { regular: chance(rng, role.regular), backbeat: chance(rng, role.backbeat ?? 0) };
    // If the optional rules can't be met, loosen them before giving up. Giving
    // up rerolls the whole patch, which quietly squeezed out the drums with the
    // strictest rules (the clap appeared far less often than its chance).
    const relaxed = { regular: true, backbeat: false };
    // Accent isn't a sound, so it may share hits with a drum
    const compare = index === ACCENT_ROW ? [] : others;

    for (const rules of [strict, relaxed]) {
        for (let attempt = 0; attempt < ROW_ATTEMPTS; attempt++) {
            // The last few attempts fall back to single signals, which fit more often
            const length = attempt > ROW_ATTEMPTS * 0.8 ? 1 : weighted(rng, CHAIN_WEIGHTS);
            const chain = randomChain(rng, length);
            const hits = hitsOf(gens, chain);
            if (fitsRole(role, rules, hits, compare)) return { chain, hits };
        }
    }
    return undefined;
}

/**
 * A new random patch. Keeps each drum's shuffle unit; shuffle amounts are
 * mostly straight, with an occasional swing on the hats and rim.
 *
 * current: { gens, rows } now. locks: { gens: [bool], rows: [bool] }; locked
 * ones come back unchanged.
 */
export function randomPatch(current, locks = {}, rng = Math.random) {
    const lockedGen = i => Boolean(locks.gens?.[i]);
    const lockedRow = i => Boolean(locks.rows?.[i]);
    const keepGens = current.gens.map((g, i) => (lockedGen(i) ? g : null));
    if (current.gens.every((_, i) => lockedGen(i)) && current.rows.every((_, i) => lockedRow(i))) return null;

    // The last attempt keeps any drum it can't fit as it was, so locks that
    // leave little room (e.g. every signal locked) still give a result
    for (let attempt = 0; attempt <= PATCH_ATTEMPTS; attempt++) {
        const lastTry = attempt === PATCH_ATTEMPTS;
        const gens = uniqueGenerators(rng, keepGens);
        // Locked rows first, so new rows are checked against them
        const others = current.rows.map((row, i) => (lockedRow(i) ? hitsOf(gens, row) : undefined));
        const rows = [];
        let ok = true;

        for (let i = 0; i < ROLES.length; i++) {
            if (lockedRow(i)) {
                rows.push(null);
                continue;
            }
            let result = randomRow(rng, gens, i, others);
            // undefined = a drum that must play couldn't be fitted; try new generators
            if (result === undefined) {
                if (!lastTry) {
                    ok = false;
                    break;
                }
                result = { chain: current.rows[i], hits: hitsOf(gens, current.rows[i]) };
            }
            others[i] = result?.hits ?? [];
            rows.push(result?.chain ?? { sigs: [null], gates: [] });
        }
        if (!ok) continue;

        const kitPerBar = others.slice(0, DRUM_COUNT).reduce((sum, h) => sum + (h?.length ?? 0), 0) / CHECK_BARS;
        if (kitPerBar > KIT_MAX_PER_BAR && !lastTry) continue;

        const groove = chance(rng, 0.35) ? pick(rng, [54, 58, 62, 66]) : 50;
        return {
            gens,
            rows: rows.map((row, i) => (row === null ? current.rows[i] : {
                sigs: row.sigs,
                gates: row.gates,
                swing: current.rows[i].swing,
                shuffle: [DRUM.closedHat, DRUM.openHat, DRUM.rim].includes(i) ? groove : 50,
            })),
        };
    }
    return null;
}
