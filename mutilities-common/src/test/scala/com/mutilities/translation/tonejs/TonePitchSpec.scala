package com.mutilities.translation.tonejs

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.prop.TableDrivenPropertyChecks

class TonePitchSpec extends AnyFlatSpec with Matchers with TableDrivenPropertyChecks {

  "TonePitch.fromMidiPitch" should "convert MIDI pitches to note names with sharps" in {
    val testCases = Table(
      ("midiPitch", "expectedNote"),
      // Boundary values
      (0, "C-1"),     // lowest MIDI pitch
      (127, "G9"),    // highest MIDI pitch
      // Reference pitches
      (60, "C4"),     // middle C
      (69, "A4"),     // A440
      // Octave boundaries
      (12, "C0"),
      (24, "C1"),
      (36, "C2"),
      // Chromatic notes in octave 4
      (61, "C#4"),
      (62, "D4"),
      (63, "D#4"),
      (64, "E4"),
      (65, "F4"),
      (66, "F#4"),
      (67, "G4"),
      (68, "G#4"),
      (70, "A#4"),
      (71, "B4")
    )

    forAll(testCases) { (midiPitch, expectedNote) =>
      TonePitch.fromMidiPitch(midiPitch) shouldBe expectedNote
    }
  }

  it should "reject invalid MIDI pitch values" in {
    val invalidPitches = Table("pitch", -1, 128)

    forAll(invalidPitches) { pitch =>
      an[IllegalArgumentException] should be thrownBy {
        TonePitch.fromMidiPitch(pitch)
      }
    }
  }

  "TonePitch.fromMidiPitchWithFlats" should "use flats for black keys" in {
    val testCases = Table(
      ("midiPitch", "expectedNote"),
      (61, "Db4"),
      (70, "Bb4"),
      // Natural notes should be unchanged
      (60, "C4"),
      (64, "E4"),
      (67, "G4")
    )

    forAll(testCases) { (midiPitch, expectedNote) =>
      TonePitch.fromMidiPitchWithFlats(midiPitch) shouldBe expectedNote
    }
  }

  "TonePitch.toFrequency" should "convert MIDI pitches to Hz frequencies" in {
    val testCases = Table(
      ("midiPitch", "expectedHz", "tolerance"),
      (69, 440.0, 0.001),   // A440
      (57, 220.0, 0.001),   // A3 (one octave below)
      (81, 880.0, 0.001),   // A5 (one octave above)
      (60, 261.63, 0.01)    // middle C
    )

    forAll(testCases) { (midiPitch, expectedHz, tolerance) =>
      TonePitch.toFrequency(midiPitch) shouldBe expectedHz +- tolerance
    }
  }
}