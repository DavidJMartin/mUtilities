package com.mutilities.translation.tonejs

import com.mutilities.domain.NoteSequence

case class ToneSequence(
    bpm: Int,
    timeSignature: (Int, Int),
    length: String,
    notes: List[ToneNote]
)

object ToneSequence {

  def fromNoteSequence(ns: NoteSequence): ToneSequence = {
    ToneSequence(
      bpm = ns.bpm,
      timeSignature = ns.timeSignature,
      length = ToneTime.fromPosition(ns.length, ns.gridResolution),
      notes = ns.notes.map(sn => ToneNote.fromSequencedNote(sn, ns.gridResolution))
    )
  }

  def empty(
      bpm: Int = 120,
      timeSignature: (Int, Int) = (4, 4),
      bars: Int = 4
  ): ToneSequence = {
    ToneSequence(
      bpm = bpm,
      timeSignature = timeSignature,
      length = s"$bars:0:0",
      notes = List.empty
    )
  }
}