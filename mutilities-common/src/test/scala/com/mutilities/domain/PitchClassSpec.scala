package com.mutilities.domain

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.prop.TableDrivenPropertyChecks

class PitchClassSpec extends AnyFlatSpec with Matchers with TableDrivenPropertyChecks {

  "PitchClass" should "correctly represent all 12 pitch classes" in {
    PitchClass.C.semitone shouldBe 0
    PitchClass.Cs.semitone shouldBe 1
    PitchClass.D.semitone shouldBe 2
    PitchClass.Ds.semitone shouldBe 3
    PitchClass.E.semitone shouldBe 4
    PitchClass.F.semitone shouldBe 5
    PitchClass.Fs.semitone shouldBe 6
    PitchClass.G.semitone shouldBe 7
    PitchClass.Gs.semitone shouldBe 8
    PitchClass.A.semitone shouldBe 9
    PitchClass.As.semitone shouldBe 10
    PitchClass.B.semitone shouldBe 11
  }

  it should "provide correct flat aliases" in {
    PitchClass.Db.semitone shouldBe PitchClass.Cs.semitone
    PitchClass.Eb.semitone shouldBe PitchClass.Ds.semitone
    PitchClass.Gb.semitone shouldBe PitchClass.Fs.semitone
    PitchClass.Ab.semitone shouldBe PitchClass.Gs.semitone
    PitchClass.Bb.semitone shouldBe PitchClass.As.semitone
  }

  "fromMidiPitch" should "extract pitch class from MIDI pitch numbers" in {
    val testCases = Table(
      ("midiPitch", "expectedPitchClass"),
      (0, 0),    // C
      (1, 1),    // C#
      (12, 0),   // C in next octave
      (13, 1),   // C# in next octave
      (60, 0),   // Middle C (C3)
      (61, 1),   // C#3
      (69, 9),   // A440 (A4)
      (127, 7),  // G8
      (24, 0),   // C0
      (36, 0),   // C1
      (48, 0)    // C2
    )

    forAll(testCases) { (midiPitch, expectedPitchClass) =>
      PitchClass.fromMidiPitch(midiPitch).semitone shouldBe expectedPitchClass
    }
  }

  it should "handle negative semitones correctly" in {
    val testCases = Table(
      ("semitone", "expectedPitchClass"),
      (-1, 11),  // wraps to B
      (-2, 10),  // wraps to Bb
      (-12, 0),  // wraps to C
      (-13, 11)  // wraps to B
    )

    forAll(testCases) { (semitone, expectedPitchClass) =>
      PitchClass(semitone).semitone shouldBe expectedPitchClass
    }
  }

  it should "normalize values greater than 11" in {
    val testCases = Table(
      ("semitone", "expectedPitchClass"),
      (12, 0),
      (13, 1),
      (24, 0),
      (25, 1)
    )

    forAll(testCases) { (semitone, expectedPitchClass) =>
      PitchClass(semitone).semitone shouldBe expectedPitchClass
    }
  }

  "semitone extension method" should "return the underlying semitone value" in {
    PitchClass.C.semitone shouldBe 0
    PitchClass.G.semitone shouldBe 7
    PitchClass(5).semitone shouldBe 5
  }
}