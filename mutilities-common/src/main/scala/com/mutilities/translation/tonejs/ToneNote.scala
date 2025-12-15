package com.mutilities.translation.tonejs

import com.mutilities.domain.{SequencedNote, GridResolution}

case class ToneNote(
    time: String,
    note: String,
    duration: String,
    velocity: Double
)

object ToneNote {

  def fromSequencedNote(sn: SequencedNote, gridResolution: GridResolution): ToneNote = {
    ToneNote(
      time = ToneTime.fromPosition(sn.start, gridResolution),
      note = TonePitch.fromMidiPitch(sn.note.midiNotePitch),
      duration = ToneDuration.fromDuration(sn.duration),
      velocity = velocityToNormalized(sn.note.midiNoteVelocity)
    )
  }

  def fromSequencedNote(sn: SequencedNote): ToneNote =
    fromSequencedNote(sn, GridResolution.sixteenths)

  def velocityToNormalized(midiVelocity: Int): Double = {
    require(
      midiVelocity >= 0 && midiVelocity <= 127,
      s"MIDI velocity must be between 0 and 127, got: $midiVelocity"
    )
    
    // Round to 2 decimal places for cleaner JSON output
    BigDecimal(midiVelocity / 127.0)
      .setScale(2, BigDecimal.RoundingMode.HALF_UP)
      .toDouble
  }

  def velocityToMidi(normalizedVelocity: Double): Int = {
    require(
      normalizedVelocity >= 0.0 && normalizedVelocity <= 1.0,
      s"Normalized velocity must be between 0.0 and 1.0, got: $normalizedVelocity"
    )
    
    Math.round(normalizedVelocity * 127).toInt
  }
}