# mUtilities - Music Inspiration Tools

A collection of inspiring music tools built as a web interface with Scala backend microservices.

Try it at **[mutilities.dajama.dev](https://mutilities.dajama.dev)**.

The name might change.

## Tools

### In Key Assistance
Interface showing keyboard, guitar and midi note display to help with improvising in key.

### Drone Synth
Playing a drone or soundscape within a key can often assist with writing melodies. This tool lets you generate and modify the soundscape while it plays.

### Key Synth
A simple playable synth, using your computer keyboard or the on-screen keys.

### Logical Drums
An algorithmic drum machine in the spirit of modular sequencers. Six signal generators (clock multipliers, dividers and Euclidean rhythms, as triggers or gates) feed drum voices through chains of logic gates. Patterns can be exported as MIDI.

## Planned

### Melody generation
Backend services to generate melodies using different techniques. Web interface should allow parameters to influence this generation.

## Technology

- **Frontend**: HTML, CSS and JavaScript modules built with Vite, audio with Tone.js, hosted on Cloudflare
- **Backend**: Scala 3, http4s, Tapir and Circe, as independent services sharing a common library (`mutilities-common`)
- **Planned**: PostgreSQL, deployed services on a VPS

## A Note on Generative AI
My plan is for these tools to inspire creativity, provide theoretical assistance and to be fun!

Part of the reason for this project is to practice my own software engineering skills while making use of coding agents.
The other half is creating tools that I'd like to use.

I do not support the use of AI to generate art and the tools provided will not facilitate this. It may use rudimentary AI techniques to melodic or rhythmic ideas but the intention is for these to spark creativity.

## Credits

Fonts are self-hosted from [Fontsource](https://fontsource.org): [Inter](https://github.com/rsms/inter) and [DM Mono](https://github.com/googlefonts/dm-mono), both under the SIL Open Font License (licence files in `mutilities-ui/src/assets/fonts/`).
