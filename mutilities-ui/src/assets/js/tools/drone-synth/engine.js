// Per voice: Synth -> Filter -> Tremolo gain -> Volume -> shared Reverb
// Shared:    Reverb -> dry / (Distortion -> makeup gain) crossfade -> Limiter -> out
//
// The volume LFO drives its own tremolo gain stage so the Volume slider keeps
// working while it's on. Callers pass whole state objects (see params.js) and
// the engine applies only what changed, since some Tone setters (e.g.
// oscillator type) rebuild nodes.

import * as Tone from 'tone';

// Tone's distortion gets harsh fast, so the Amount slider's full range maps
// onto the gentler bottom half of it.
const DISTORTION_MAX = 0.5;
const LIMITER_THRESHOLD_DB = -1;

// Tames the jump in level when distortion is switched on. Tone's curve
// boosts quiet signals by (3 + k) / 9 (k = amount * 100), but it also
// squashes peaks, so fully dividing that out overcorrects. An exponent of
// 0.75 measured as level-matched at the default drone levels; 0.6 leaves a
// deliberate lift of roughly 3 dB at higher amounts so distortion still has
// some impact.
const MAKEUP_EXPONENT = 0.6;

function distortionMakeupGain(amount) {
    const k = amount * DISTORTION_MAX * 100;
    return 3 * Math.pow(3 / (3 + k), MAKEUP_EXPONENT);
}

export class DroneEngine {
    constructor(fx, voices) {
        this.playing = false;

        this.limiter = new Tone.Limiter(LIMITER_THRESHOLD_DB).toDestination();
        this.distortionMix = new Tone.CrossFade(0).connect(this.limiter);
        this.distortionMakeup = new Tone.Gain(1).connect(this.distortionMix.b);
        this.distortion = new Tone.Distortion({ wet: 1, oversample: '2x' }).connect(this.distortionMakeup);

        this.reverb = new Tone.Reverb({ decay: fx.reverb.decay, preDelay: 0.01, wet: 0 });
        this.reverb.connect(this.distortionMix.a);
        this.reverb.connect(this.distortion);
        this.fx = null;
        this.setFx(fx);

        this.voices = voices.map(state => this.#createVoice(state));
    }

    #createVoice(state) {
        const volume = new Tone.Volume(state.volume).connect(this.reverb);
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
        if (!prev || fx.distortion.amount !== prev.distortion.amount) {
            this.distortion.distortion = fx.distortion.amount * DISTORTION_MAX;
            this.distortionMakeup.gain.value = distortionMakeupGain(fx.distortion.amount);
        }
        this.reverb.wet.value = fx.reverb.on ? fx.reverb.mix : 0;
        this.distortionMix.fade.value = fx.distortion.on ? fx.distortion.mix : 0;
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
