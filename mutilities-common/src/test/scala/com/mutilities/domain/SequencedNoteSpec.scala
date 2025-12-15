package com.mutilities.domain

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

class SequencedNoteSpec extends AnyFlatSpec with Matchers {

  "A SequencedNote" should "be created with note, start position, and duration" in {
    val note = Note(60, 100)
    val start = Position(1, 2, 0)
    val duration = Duration.quarter

    val seqNote = SequencedNote(note, start, duration)

    seqNote.note shouldBe note
    seqNote.start shouldBe start
    seqNote.duration shouldBe duration
  }

  "SequencedNote convenience constructor" should "create note from pitch with default velocity" in {
    val start = Position(0, 0, 0)
    val duration = Duration.eighth

    val seqNote = SequencedNote(60, start, duration)

    seqNote.note.midiNotePitch shouldBe 60
    seqNote.note.midiNoteVelocity shouldBe 100
    seqNote.start shouldBe start
    seqNote.duration shouldBe duration
  }

  it should "work with different positions and durations" in {
    val seqNote = SequencedNote(72, Position.bar(2), Duration.whole)

    seqNote.note.midiNotePitch shouldBe 72
    seqNote.start shouldBe Position(2, 0, 0)
    seqNote.duration.beats shouldBe BigDecimal(4)
  }
}