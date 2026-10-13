// Each factory returns { el, set } so callers can push a new value in
// (e.g. after randomising) without rebuilding the control.

import { el, uid, setOptions } from '../core/dom.js';

// With scale: 'log' the track maps to the value logarithmically, so each
// doubling takes the same distance; useful when the low end matters most (e.g.
// LFO rates). min must then be above 0, and step is ignored.
const LOG_STEPS = 1000;

export function createSlider({ label, min, max, step, value, format, onInput, tone = 'accent', scale = 'linear' }) {
    const id = uid('slider');
    const log = scale === 'log';
    const toValue = pos => (log ? min * (max / min) ** (pos / LOG_STEPS) : pos);
    const toPos = v => (log ? (Math.log(v / min) / Math.log(max / min)) * LOG_STEPS : v);

    const output = el('output', { class: 'slider__value', for: id });
    const input = el('input', {
        class: 'slider__input',
        type: 'range',
        id,
        min: log ? 0 : min,
        max: log ? LOG_STEPS : max,
        step: log ? 1 : step,
    });

    const render = (v) => {
        const lo = log ? 0 : min;
        const hi = log ? LOG_STEPS : max;
        const pct = Math.min(100, Math.max(0, ((toPos(v) - lo) / (hi - lo)) * 100));
        input.style.setProperty('--pct', `${pct}%`);
        output.textContent = format(v);
    };

    input.addEventListener('input', () => {
        const v = toValue(Number(input.value));
        render(v);
        onInput(v);
    });

    const set = (v) => {
        input.value = String(toPos(v));
        render(v);
    };
    set(value);

    const root = el('div', { class: ['slider', tone !== 'accent' && `slider--${tone}`] },
        el('div', { class: 'slider__head' },
            el('label', { class: 'slider__label', for: id, text: label }),
            output
        ),
        input
    );

    return { el: root, set };
}

export function createSwitch({ label, checked, onChange, small = false }) {
    const button = el('button', {
        class: ['switch', small && 'switch--sm'],
        type: 'button',
        role: 'switch',
        'aria-label': label,
    }, el('span', { class: 'switch__knob', 'aria-hidden': 'true' }));

    const set = (on) => button.setAttribute('aria-checked', String(on));

    button.addEventListener('click', () => {
        const next = button.getAttribute('aria-checked') !== 'true';
        set(next);
        onChange(next);
    });

    set(checked);
    return { el: button, set };
}

/** A group of toggle buttons where exactly one is pressed */
export function createSegmented({ label, options, value, onChange, small = false }) {
    const buttons = options.map(option => el('button', {
        class: 'segmented__option',
        type: 'button',
        dataset: { value: option.value },
        text: option.label,
    }));

    const set = (v) => {
        buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === v)));
    };

    const root = el('div', {
        class: ['segmented', small && 'segmented--sm'],
        role: 'group',
        'aria-label': label,
        on: {
            click: (event) => {
                const button = event.target.closest('.segmented__option');
                if (!button || button.getAttribute('aria-pressed') === 'true') return;
                set(button.dataset.value);
                onChange(button.dataset.value);
            },
        },
    }, buttons);

    set(value);
    return { el: root, set };
}

/** layout: 'field' stacks the label above, 'inline' puts it beside */
export function createSelect({ label, options, value, onChange, layout = 'field', size }) {
    const select = el('select', { on: { change: () => onChange(select.value) } });
    setOptions(select, options, value);

    const wrapper = el('span', { class: ['select', size && `select--${size}`] }, select);
    const root = el('label', { class: ['field', layout === 'inline' && 'field--inline'] },
        el('span', { class: 'field__label', text: label }),
        wrapper
    );

    return {
        el: root,
        set: (v) => { select.value = v; },
        setOptions: (opts, v) => setOptions(select, opts, v),
    };
}

/**
 * − value + buttons. The caller owns the value: onStep(-1 | 1) asks for a
 * change and set(text, disabled) shows the result. With repeat, holding a
 * button keeps stepping, faster after a moment.
 */
export function createStepper({ label, hint, onStep, inline = false, repeat = false }) {
    const value = el('span', { class: 'stepper__value' });

    const button = (dir, text) => {
        const b = el('button', {
            class: 'stepper__btn',
            type: 'button',
            'aria-label': `${dir < 0 ? 'Decrease' : 'Increase'} ${label.toLowerCase()}`,
            text,
        });
        if (repeat) {
            b.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                holdRepeat(b, () => onStep(dir));
            });
            // Keyboard activation still works as a single step
            b.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onStep(dir);
                }
            });
        } else {
            b.addEventListener('click', () => onStep(dir));
        }
        return b;
    };

    const down = button(-1, '−');
    const up = button(1, '+');

    const root = el('div', { class: ['stepper', inline && 'stepper--inline'] },
        label && el('div', { class: 'stepper__head' },
            el('span', { class: 'stepper__label', text: label }),
            hint && el('span', { class: 'stepper__hint', text: hint })
        ),
        el('div', { class: 'stepper__controls' }, down, value, up)
    );

    const set = (text, disabled = false) => {
        value.textContent = text;
        down.disabled = disabled;
        up.disabled = disabled;
        root.toggleAttribute('data-disabled', disabled);
    };

    return { el: root, set };
}

function holdRepeat(button, step) {
    let count = 0;
    let timer;
    step();

    const next = () => {
        count += 1;
        step();
        timer = setTimeout(next, count > 12 ? 60 : 90);
    };
    timer = setTimeout(next, 380);

    const stop = () => {
        clearTimeout(timer);
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => button.removeEventListener(e, stop));
    };
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => button.addEventListener(e, stop));
}
