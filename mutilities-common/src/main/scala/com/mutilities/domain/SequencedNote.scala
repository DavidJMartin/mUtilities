package com.mutilities.domain

case class SequencedNote(
    note: Note,
    start: Position,
    duration: Duration
)

object SequencedNote {
  def apply(pitch: Int, start: Position, duration: Duration): SequencedNote =
    SequencedNote(
      note = Note(midiNotePitch = pitch, midiNoteVelocity = 100),
      start = start,
      duration = duration
    )
}