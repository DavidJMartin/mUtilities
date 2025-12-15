package com.mutilities.translation.tonejs

object TonePitch {

  private val noteNames: Array[String] = Array(
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
  )

  def fromMidiPitch(pitch: Int): String = {
    require(
      pitch >= 0 && pitch <= 127,
      s"MIDI pitch must be between 0 and 127, got: $pitch"
    )

    val noteName = noteNames(pitch % 12)
    val octave = (pitch / 12) - 1  // MIDI octave: C4 = 60 means 60/12 - 1 = 4
    
    s"$noteName$octave"
  }

  def fromMidiPitchWithFlats(pitch: Int): String = {
    require(
      pitch >= 0 && pitch <= 127,
      s"MIDI pitch must be between 0 and 127, got: $pitch"
    )

    val flatNoteNames = Array(
      "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"
    )

    val noteName = flatNoteNames(pitch % 12)
    val octave = (pitch / 12) - 1
    
    s"$noteName$octave"
  }

  def toFrequency(pitch: Int): Double = {
    require(
      pitch >= 0 && pitch <= 127,
      s"MIDI pitch must be between 0 and 127, got: $pitch"
    )
    
    440.0 * Math.pow(2.0, (pitch - 69) / 12.0)
  }
}