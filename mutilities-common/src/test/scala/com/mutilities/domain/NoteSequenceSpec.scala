package com.mutilities.domain

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

class NoteSequenceSpec extends AnyFlatSpec with Matchers {

  "A NoteSequence" should "be created with notes and length" in {
    val note1 = SequencedNote(60, Position.zero, Duration.quarter)
    val note2 = SequencedNote(64, Position(0, 1, 0), Duration.quarter)
    val notes = List(note1, note2)

    val seq = NoteSequence(notes, Position.bar(1))

    seq.notes shouldBe notes
    seq.length shouldBe Position.bar(1)
  }

  it should "use default values for bpm, timeSignature, and gridResolution" in {
    val seq = NoteSequence(List.empty, Position.bar(4))

    seq.bpm shouldBe 120
    seq.timeSignature shouldBe (4, 4)
    seq.gridResolution shouldBe GridResolution.sixteenths
  }

  it should "allow custom bpm and time signature" in {
    val seq = NoteSequence(
      notes = List.empty,
      length = Position.bar(2),
      bpm = 90,
      timeSignature = (3, 4)
    )

    seq.bpm shouldBe 90
    seq.timeSignature shouldBe (3, 4)
  }

  "NoteSequence.empty" should "create an empty sequence with specified bar length" in {
    val seq = NoteSequence.empty(8)

    seq.notes shouldBe empty
    seq.length shouldBe Position.bar(8)
    seq.bpm shouldBe 120
    seq.timeSignature shouldBe (4, 4)
    seq.gridResolution shouldBe GridResolution.sixteenths
  }

  it should "work with zero bars" in {
    val seq = NoteSequence.empty(0)
    seq.length shouldBe Position.zero
  }
}