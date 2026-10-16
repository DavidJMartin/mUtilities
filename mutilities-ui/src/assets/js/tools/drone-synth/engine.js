// Per voice: Synth -> Filter -> Tremolo gain -> Volume -> shared bus
// Shared:    bus -> dry / (Saturation -> DC block -> Tone) switch
//            -> Space (reverb + tail modulation, see space.js) -> Limiter -> out
//
// Saturation sits before the reverb so the reverb smooths the grit rather
// than the tail itself being distorted.
//
// The volume LFO sweeps in decibels, not linear gain: a linear sweep sounds
// near full volume for most of its cycle with a quick dip, while a dB sweep
// spends real time faded. The LFO runs -1..1 through a curve that maps it to
// 0 dB … −depth. It drives its own tremolo gain stage so the Volume slider keeps
// working while it's on. Callers pass whole state objects (see params.js) and
// the engine applies only what changed, since some Tone setters (e.g.
// oscillator type) rebuild nodes.

import * as Tone from 'tone';
import { saturationCurve, toneFrequency } from './saturation.js';
import { Space } from './space.js';
import { TextureEngine } from './texture.js';

const LIMITER_THRESHOLD_DB = -1;

// Make-up gain per filter type, so randomised patches don't drop away
const FILTER_MAKEUP_DB = { lowpass: 0, highpass: 3, bandpass: 8, notch: 0 };

export class DroneEngine {
    constructor(fx, voices, texture) {
        this.playing = false;

        this.limiter = new Tone.Limiter(LIMITER_THRESHOLD_DB).toDestination();
        this.space = new Space(fx.reverb);
        this.space.output.connect(this.limiter);

        // Switches between the dry bus and the saturated path; the dry/wet
        // Mix itself happens inside the saturation curve
        this.saturationSwitch = new Tone.CrossFade(0).connect(this.space.input);
        this.saturationTone = new Tone.Filter({ type: 'lowpass', rolloff: -12 }).connect(this.saturationSwitch.b);
        // The tube curve is asymmetric, which leaves a DC offset to filter out
        this.dcBlock = new Tone.Filter({ type: 'highpass', frequency: 10 }).connect(this.saturationTone);
        this.saturator = new Tone.WaveShaper();
        this.saturator.oversample = '4x';
        this.saturator.connect(this.dcBlock);

        // Trimmed to sit under the drums (levels measured 16 Oct)
        this.bus = new Tone.Gain(Tone.dbToGain(-2));
        this.bus.connect(this.saturationSwitch.a);
        this.bus.connect(this.saturator);
        this.fx = null;
        this.setFx(fx);

        this.voices = voices.map(state => this.#createVoice(state));

        // The bed goes through the reverb; crackle joins after it, dry
        this.texture = new TextureEngine(texture, { wet: this.space.input, dry: this.limiter });
        this.textureOn = texture.on;
    }

    setTexture(params) {
        this.textureOn = params.on;
        this.texture.set(params);
        this.texture.setActive(this.playing && this.textureOn);
    }

    /** Pitch drift: move a voice's detune (cents) over the given time */
    setDetune(index, cents, seconds) {
        this.voices[index].synth.detune.rampTo(cents, seconds);
    }

    #createVoice(state) {
        const volume = new Tone.Volume(state.volume).connect(this.bus);
        const tremolo = new Tone.Gain(1).connect(volume);
        // Band-pass and high-pass filters remove a lot of level; give some back
        const makeup = new Tone.Gain(Tone.dbToGain(FILTER_MAKEUP_DB[state.filterType] ?? 0)).connect(tremolo);
        const filter = new Tone.Filter({ type: state.filterType, frequency: state.filterFreq, Q: state.filterRes }).connect(makeup);
        const synth = new Tone.Synth({
            oscillator: { type: state.shape },
            envelope: { attack: 2, decay: 0, sustain: 1, release: 2 },
        }).connect(filter);

        const filterLfo = new Tone.LFO({ frequency: state.filterLfoRate });
        const ampLfo = new Tone.LFO({ frequency: state.ampLfoRate, min: -1, max: 1 });
        const ampCurve = new Tone.WaveShaper(() => 1, 1024);
        ampLfo.connect(ampCurve);

        const voice = {
            synth, filter, makeup, tremolo, volume, filterLfo, ampLfo, ampCurve,
            state,
            sounding: false,
            filterLfoConnected: false,
            ampLfoConnected: false,
        };
        this.#updateLfoRanges(voice);
        return voice;
    }

    start() {
        this.playing = true;
        this.voices.forEach(voice => this.#syncVoice(voice));
        this.texture.setActive(this.textureOn);
    }

    stop() {
        this.playing = false;
        this.voices.forEach(voice => this.#syncVoice(voice));
        this.texture.setActive(false);
    }

    /** glide: seconds to slide to a new note instead of jumping (used by drift) */
    setVoice(index, next, { glide = 0 } = {}) {
        const voice = this.voices[index];
        const prev = voice.state;
        voice.state = next;

        if (next.shape !== prev.shape) voice.synth.oscillator.type = next.shape;
        if (next.volume !== prev.volume) voice.volume.volume.value = next.volume;
        if (next.filterType !== prev.filterType) {
            voice.filter.type = next.filterType;
            voice.makeup.gain.rampTo(Tone.dbToGain(FILTER_MAKEUP_DB[next.filterType] ?? 0), 0.1);
        }
        if (next.filterRes !== prev.filterRes) voice.filter.Q.value = next.filterRes;
        if (next.filterLfoRate !== prev.filterLfoRate) voice.filterLfo.frequency.value = next.filterLfoRate;
        if (next.ampLfoRate !== prev.ampLfoRate) voice.ampLfo.frequency.value = next.ampLfoRate;

        if (next.filterFreq !== prev.filterFreq && !voice.filterLfoConnected) {
            this.#setFilterFrequency(voice, next.filterFreq);
        }
        if (next.filterFreq !== prev.filterFreq || next.filterLfoDepth !== prev.filterLfoDepth || next.ampLfoDepth !== prev.ampLfoDepth) {
            this.#updateLfoRanges(voice);
        }

        // Change pitch rather than retriggering the slow attack
        if (next.note !== prev.note && voice.sounding) {
            if (glide > 0) {
                voice.synth.frequency.exponentialRampTo(Tone.Frequency(next.note).toFrequency(), glide);
            } else {
                voice.synth.setNote(next.note);
            }
        }

        this.#syncVoice(voice);
    }

    setFx(fx) {
        const prev = this.fx;
        this.fx = fx;

        this.space.set(fx.reverb);
        const sat = fx.saturation;
        const prevSat = prev?.saturation;
        if (!prevSat || sat.mode !== prevSat.mode || sat.drive !== prevSat.drive || sat.mix !== prevSat.mix) {
            this.saturator.curve = saturationCurve(sat.mode, sat.drive, sat.mix);
        }
        this.saturationTone.frequency.value = toneFrequency(sat.tone);
        this.saturationSwitch.fade.value = sat.on ? 1 : 0;
    }

    #syncVoice(voice) {
        const { state } = voice;
        const shouldSound = this.playing && state.on;

        if (shouldSound && !voice.sounding) {
            voice.synth.triggerAttack(state.note);
        } else if (!shouldSound && voice.sounding) {
            voice.synth.triggerRelease();
        }
        voice.sounding = shouldSound;

        this.#syncFilterLfo(voice, shouldSound && state.filterLfoOn);
        this.#syncAmpLfo(voice, shouldSound && state.ampLfoOn);
    }

    #syncFilterLfo(voice, wanted) {
        if (wanted === voice.filterLfoConnected) return;
        voice.filterLfoConnected = wanted;

        if (wanted) {
            voice.filterLfo.connect(voice.filter.frequency);
            voice.filterLfo.start();
        } else {
            voice.filterLfo.stop();
            voice.filterLfo.disconnect();
            this.#setFilterFrequency(voice, voice.state.filterFreq);
        }
    }

    #syncAmpLfo(voice, wanted) {
        if (wanted === voice.ampLfoConnected) return;
        voice.ampLfoConnected = wanted;

        if (wanted) {
            // The curve's output adds to the gain's own value, so zero that
            voice.tremolo.gain.value = 0;
            voice.ampCurve.connect(voice.tremolo.gain);
            voice.ampLfo.start();
        } else {
            voice.ampLfo.stop();
            voice.ampCurve.disconnect();
            voice.tremolo.gain.value = 1;
        }
    }

    #setFilterFrequency(voice, hz) {
        // Connecting an LFO marks the frequency signal as overridden, after
        // which Tone ignores direct values. Clear that once the LFO is off.
        voice.filter.frequency.overridden = false;
        voice.filter.frequency.value = hz;
    }

    #updateLfoRanges(voice) {
        const { filterFreq, filterLfoDepth, ampLfoDepth } = voice.state;
        const depth = filterLfoDepth / 100;
        voice.filterLfo.min = filterFreq * (1 - depth);
        voice.filterLfo.max = filterFreq * (1 + depth);
        // LFO at +1 = full volume, at −1 = −depth dB, evenly in dB between
        voice.ampCurve.setMap(x => Tone.dbToGain((-ampLfoDepth * (1 - x)) / 2));
    }
}
