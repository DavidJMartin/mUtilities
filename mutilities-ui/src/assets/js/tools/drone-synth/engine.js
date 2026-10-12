// Per voice: Synth -> Filter -> Tremolo gain -> Volume -> shared bus
// Shared:    bus -> dry / (Saturation -> DC block -> Tone) switch
//            -> Reverb -> Limiter -> out
//
// Saturation sits before the reverb so the reverb smooths the grit rather
// than the tail itself being distorted.
//
// The volume LFO drives its own tremolo gain stage so the Volume slider keeps
// working while it's on. Callers pass whole state objects (see params.js) and
// the engine applies only what changed, since some Tone setters (e.g.
// oscillator type) rebuild nodes.

import * as Tone from 'tone';
import { saturationCurve, toneFrequency } from './saturation.js';

const LIMITER_THRESHOLD_DB = -1;

export class DroneEngine {
    constructor(fx, voices) {
        this.playing = false;

        this.limiter = new Tone.Limiter(LIMITER_THRESHOLD_DB).toDestination();
        this.reverb = new Tone.Reverb({ decay: fx.reverb.decay, preDelay: 0.01, wet: 0 }).connect(this.limiter);

        // Switches between the dry bus and the saturated path; the dry/wet
        // Mix itself happens inside the saturation curve
        this.saturationSwitch = new Tone.CrossFade(0).connect(this.reverb);
        this.saturationTone = new Tone.Filter({ type: 'lowpass', rolloff: -12 }).connect(this.saturationSwitch.b);
        // The tube curve is asymmetric, which leaves a DC offset to filter out
        this.dcBlock = new Tone.Filter({ type: 'highpass', frequency: 10 }).connect(this.saturationTone);
        this.saturator = new Tone.WaveShaper();
        this.saturator.oversample = '4x';
        this.saturator.connect(this.dcBlock);

        this.bus = new Tone.Gain(1);
        this.bus.connect(this.saturationSwitch.a);
        this.bus.connect(this.saturator);
        this.fx = null;
        this.setFx(fx);

        this.voices = voices.map(state => this.#createVoice(state));
    }

    #createVoice(state) {
        const volume = new Tone.Volume(state.volume).connect(this.bus);
        const tremolo = new Tone.Gain(1).connect(volume);
        const filter = new Tone.Filter({ type: state.filterType, frequency: state.filterFreq, Q: state.filterRes }).connect(tremolo);
        const synth = new Tone.Synth({
            oscillator: { type: state.shape },
            envelope: { attack: 2, decay: 0, sustain: 1, release: 2 },
        }).connect(filter);

        const filterLfo = new Tone.LFO({ frequency: state.filterLfoRate });
        const ampLfo = new Tone.LFO({ frequency: state.ampLfoRate, max: 1 });

        const voice = {
            synth, filter, tremolo, volume, filterLfo, ampLfo,
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
    }

    stop() {
        this.playing = false;
        this.voices.forEach(voice => this.#syncVoice(voice));
    }

    setVoice(index, next) {
        const voice = this.voices[index];
        const prev = voice.state;
        voice.state = next;

        if (next.shape !== prev.shape) voice.synth.oscillator.type = next.shape;
        if (next.volume !== prev.volume) voice.volume.volume.value = next.volume;
        if (next.filterType !== prev.filterType) voice.filter.type = next.filterType;
        if (next.filterRes !== prev.filterRes) voice.filter.Q.value = next.filterRes;
        if (next.filterLfoRate !== prev.filterLfoRate) voice.filterLfo.frequency.value = next.filterLfoRate;
        if (next.ampLfoRate !== prev.ampLfoRate) voice.ampLfo.frequency.value = next.ampLfoRate;

        if (next.filterFreq !== prev.filterFreq && !voice.filterLfoConnected) {
            this.#setFilterFrequency(voice, next.filterFreq);
        }
        if (next.filterFreq !== prev.filterFreq || next.filterLfoDepth !== prev.filterLfoDepth || next.ampLfoDepth !== prev.ampLfoDepth) {
            this.#updateLfoRanges(voice);
        }

        // Glide straight to a new note rather than retriggering the slow attack
        if (next.note !== prev.note && voice.sounding) voice.synth.setNote(next.note);

        this.#syncVoice(voice);
    }

    setFx(fx) {
        const prev = this.fx;
        this.fx = fx;

        if (!prev || fx.reverb.decay !== prev.reverb.decay) this.reverb.decay = fx.reverb.decay;
        const sat = fx.saturation;
        const prevSat = prev?.saturation;
        if (!prevSat || sat.mode !== prevSat.mode || sat.drive !== prevSat.drive || sat.mix !== prevSat.mix) {
            this.saturator.curve = saturationCurve(sat.mode, sat.drive, sat.mix);
        }
        this.saturationTone.frequency.value = toneFrequency(sat.tone);
        this.reverb.wet.value = fx.reverb.on ? fx.reverb.mix : 0;
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
            voice.ampLfo.connect(voice.tremolo.gain);
            voice.ampLfo.start();
        } else {
            voice.ampLfo.stop();
            voice.ampLfo.disconnect();
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
        voice.ampLfo.min = Tone.dbToGain(-ampLfoDepth);
    }
}
