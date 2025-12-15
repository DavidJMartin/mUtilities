package com.mutilities.domain

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.prop.TableDrivenPropertyChecks

class NoteSpec extends AnyFlatSpec with Matchers with TableDrivenPropertyChecks {

  "A Note" should "be created with valid values" in {
    val note = Note(60, 100, 1)
    note.midiNotePitch shouldBe 60
    note.midiNoteVelocity shouldBe 100
    note.midiChannel shouldBe 1
  }

  it should "use default channel 1 when not specified" in {
    val note = Note(60, 100)
    note.midiChannel shouldBe 1
  }

  it should "validate parameter boundaries" in {
    val validCases = Table(
      ("pitch", "velocity", "channel"),
      (0, 64, 1),        // minimum pitch
      (127, 64, 1),      // maximum pitch
      (60, 0, 1),        // minimum velocity
      (60, 127, 1),      // maximum velocity
      (60, 64, 1),       // minimum channel
      (60, 64, 16)       // maximum channel
    )

    forAll(validCases) { (pitch, velocity, channel) =>
      noException should be thrownBy Note(pitch, velocity, channel)
    }
  }

  it should "reject invalid parameter values" in {
    val invalidCases = Table(
      ("pitch", "velocity", "channel", "errorMessage"),
      (-1, 64, 1, "midiNotePitch must be between 0 and 127"),
      (128, 64, 1, "midiNotePitch must be between 0 and 127"),
      (60, -1, 1, "midiNoteVelocity must be between 0 and 127"),
      (60, 128, 1, "midiNoteVelocity must be between 0 and 127"),
      (60, 64, 0, "midiChannel must be between 1 and 16"),
      (60, 64, 17, "midiChannel must be between 1 and 16")
    )

    forAll(invalidCases) { (pitch, velocity, channel, errorMessage) =>
      val exception = intercept[IllegalArgumentException] {
        Note(pitch, velocity, channel)
      }
      exception.getMessage should include(errorMessage)
    }
  }

  "notePitchReadable" should "return correct note names" in {
    val testCases = Table(
      ("midiNote", "expectedNoteName"),
      (0, "C"),
      (1, "C#"),
      (2, "D"),
      (5, "F"),
      (7, "G"),
      (9, "A"),
      (11, "B"),
      (60, "C"),  // middle C
      (61, "C#"),
      (69, "A")   // A440
    )

    forAll(testCases) { (midiNote, expectedNoteName) =>
      val note = Note(midiNote, 64, 1)
      note.notePitchReadable shouldBe expectedNoteName
    }
  }

  "noteAndOctaveReadable" should "return correct note and octave" in {
    val testCases = Table(
      ("midiNote", "expectedNoteAndOctave"),
      (0, "C-2"),
      (12, "C-1"),
      (24, "C0"),
      (36, "C1"),
      (48, "C2"),
      (60, "C3"),   // middle C
      (72, "C4"),
      (81, "A4"),   // A440
      (127, "G8")
    )

    forAll(testCases) { (midiNote, expectedNoteAndOctave) =>
      val note = Note(midiNote, 64, 1)
      note.noteAndOctaveReadable shouldBe expectedNoteAndOctave
    }
  }

  "Note.randomNote()" should "generate valid random notes" in {
    val note = Note.randomNote()
    note.midiNotePitch should (be >= 0 and be <= 127)
    note.midiNoteVelocity should (be >= 0 and be <= 127)
    note.midiChannel shouldBe 1
  }

  it should "generate different notes on multiple calls" in {
    val notes = (1 to 20).map(_ => Note.randomNote())
    val allSame = notes.forall(n => 
      n.midiNotePitch == notes.head.midiNotePitch && 
      n.midiNoteVelocity == notes.head.midiNoteVelocity
    )
    allSame shouldBe false
  }
}