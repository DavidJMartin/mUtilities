package com.mutilities.domain

case class NoteSequence(
    notes: List[SequencedNote],
    length: Position,
    bpm: Int = 120,
    timeSignature: (Int, Int) = (4, 4),
    gridResolution: GridResolution = GridResolution.sixteenths,
    key: Option[Key] = None
)

object NoteSequence {
  def empty(bars: Int): NoteSequence =
    NoteSequence(
      notes = List.empty,
      length = Position.bar(bars)
    )
}