package com.mutilities.domain

import scala.util.Random

case class Note(
                midiNotePitch: Int,
                midiNoteVelocity: Int,
                midiChannel: Int = 1
) {
  require(
    midiNotePitch >= 0 && midiNotePitch <= 127,
    s"midiNotePitch must be between 0 and 127, got: $midiNotePitch"
  )
  
  require(
    midiNoteVelocity >= 0 && midiNoteVelocity <= 127,
    s"midiNoteVelocity must be between 0 and 127, got: $midiNoteVelocity"
  )
  
  require(
    midiChannel >= 1 && midiChannel <= 16,
    s"midiChannel must be between 1 and 16, got: $midiChannel"
  )

  def notePitchReadable: String = {
    val noteNames = Array("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
    noteNames(midiNotePitch % 12)
  }

  def noteAndOctaveReadable: String = {
    val octave = (midiNotePitch / 12) - 2
    s"${notePitchReadable}$octave"
  }
}

object Note {
  def randomNote(): Note = {
    val random = new Random()
    Note(
      midiNotePitch = random.nextInt(128),
      midiNoteVelocity = random.nextInt(128),
      midiChannel = 1
    )
  }
}
