package com.mutilities.domain

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.prop.TableDrivenPropertyChecks

class KeySpec extends AnyFlatSpec with Matchers with TableDrivenPropertyChecks {

  "Key.pitchClasses" should "generate correct pitch classes for various keys" in {
    val testCases = Table(
      ("key", "expectedPitchClasses"),
      (Key(PitchClass.C, Scale.Major), List(0, 2, 4, 5, 7, 9, 11)),
      (Key(PitchClass.D, Scale.Major), List(2, 4, 6, 7, 9, 11, 1)),
      (Key(PitchClass.A, Scale.Minor), List(9, 11, 0, 2, 4, 5, 7)),
      (Key(PitchClass.Fs, Scale.Major), List(6, 8, 10, 11, 1, 3, 5))
    )

    forAll(testCases) { (key, expectedPitchClasses) =>
      key.pitchClasses.map(_.semitone) shouldBe expectedPitchClasses
    }
  }

  "containsPitch" should "correctly identify pitches in keys" in {
    val cMajor = Key(PitchClass.C, Scale.Major)
    val dMinor = Key(PitchClass.D, Scale.Minor)
    
    val testCases = Table(
      ("key", "pitch", "expectedResult"),
      // C Major: in-key pitches
      (cMajor, 0, true),
      (cMajor, 12, true),
      (cMajor, 60, true),
      (cMajor, 64, true),
      (cMajor, 67, true),
      // C Major: out-of-key pitches
      (cMajor, 1, false),
      (cMajor, 61, false),
      (cMajor, 63, false),
      (cMajor, 66, false),
      // D Minor: in-key pitches
      (dMinor, 62, true),
      (dMinor, 65, true),
      (dMinor, 69, true),
      // D Minor: out-of-key pitches
      (dMinor, 63, false),
      (dMinor, 68, false)
    )

    forAll(testCases) { (key, pitch, expectedResult) =>
      key.containsPitch(pitch) shouldBe expectedResult
    }
  }

  "nearestInKey" should "return same pitch if already in key" in {
    val key = Key(PitchClass.C, Scale.Major)
    val inKeyPitches = Table("pitch", 60, 62, 64, 65, 67, 69, 71)

    forAll(inKeyPitches) { pitch =>
      key.nearestInKey(pitch) shouldBe pitch
    }
  }

  it should "snap to nearest in-key pitch" in {
    val key = Key(PitchClass.C, Scale.Major)
    val snapCases = Table(
      ("inputPitch", "expectedPitch"),
      (61, 60),  // C# -> C
      (63, 62),  // Eb -> D
      (66, 65),  // F# -> F
      (68, 67),  // Ab -> G
      (70, 69)   // Bb -> A
    )

    forAll(snapCases) { (inputPitch, expectedPitch) =>
      key.nearestInKey(inputPitch) shouldBe expectedPitch
    }
  }

  it should "round down on equidistant pitches" in {
    val key = Key(PitchClass.C, Scale.Major)
    val equidistantCases = Table(
      ("inputPitch", "expectedPitch", "description"),
      (61, 60, "C# equidistant from C and D"),
      (66, 65, "F# equidistant from F and G"),
      (68, 67, "Ab equidistant from G and A")
    )

    forAll(equidistantCases) { (inputPitch, expectedPitch, _) =>
      key.nearestInKey(inputPitch) shouldBe expectedPitch
    }
  }

  it should "handle MIDI range extremes" in {
    val key = Key(PitchClass.C, Scale.Major)
    val extremeCases = Table(
      ("inputPitch", "expectedPitch"),
      (0, 0),      // C-2
      (1, 0),      // C#-2 -> C-2
      (2, 2),      // D-2
      (125, 125),  // F8
      (126, 125),  // F#8 -> F8
      (127, 127)   // G8
    )

    forAll(extremeCases) { (inputPitch, expectedPitch) =>
      key.nearestInKey(inputPitch) shouldBe expectedPitch
    }
  }

  it should "work correctly across octaves" in {
    val key = Key(PitchClass.C, Scale.Major)
    val octaveCases = Table(
      ("inputPitch", "expectedPitch"),
      (1, 0),    // C#-2 -> C-2
      (13, 12),  // C#-1 -> C-1
      (25, 24),  // C#0 -> C0
      (37, 36),  // C#1 -> C1
      (49, 48),  // C#2 -> C2
      (61, 60),  // C#3 -> C3
      (73, 72)   // C#4 -> C4
    )

    forAll(octaveCases) { (inputPitch, expectedPitch) =>
      key.nearestInKey(inputPitch) shouldBe expectedPitch
    }
  }

  it should "handle pentatonic scales" in {
    val key = Key(PitchClass.C, Scale.PentatonicMajor)
    val pentatonicCases = Table(
      ("inputPitch", "expectedPitch"),
      (60, 60),  // C -> C
      (61, 60),  // C# -> C
      (63, 62),  // Eb -> D
      (65, 64),  // F -> E
      (66, 67)   // F# -> G
    )

    forAll(pentatonicCases) { (inputPitch, expectedPitch) =>
      key.nearestInKey(inputPitch) shouldBe expectedPitch
    }
  }

  it should "handle different root notes" in {
    val key = Key(PitchClass.D, Scale.Major)
    val rootCases = Table(
      ("inputPitch", "expectedPitch"),
      (60, 59),  // C -> B
      (61, 61),  // C# -> C#
      (62, 62),  // D -> D
      (63, 62)   // Eb -> D
    )

    forAll(rootCases) { (inputPitch, expectedPitch) =>
      key.nearestInKey(inputPitch) shouldBe expectedPitch
    }
  }

  "Key equality" should "work correctly" in {
    val key1 = Key(PitchClass.C, Scale.Major)
    val key2 = Key(PitchClass.C, Scale.Major)
    val key3 = Key(PitchClass.D, Scale.Major)
    val key4 = Key(PitchClass.C, Scale.Minor)
    
    key1 shouldBe key2
    key1 should not be key3
    key1 should not be key4
  }
}