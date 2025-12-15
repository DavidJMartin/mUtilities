package com.mutilities.translation.tonejs

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.prop.TableDrivenPropertyChecks
import com.mutilities.domain.{Note, Position, Duration, SequencedNote, GridResolution}

class ToneNoteSpec extends AnyFlatSpec with Matchers with TableDrivenPropertyChecks {

  "ToneNote.fromSequencedNote" should "convert sequenced notes correctly" in {
    val sn = SequencedNote(
      note = Note(midiNotePitch = 60, midiNoteVelocity = 100),
      start = Position(0, 0, 0),
      duration = Duration.quarter
    )
    
    val result = ToneNote.fromSequencedNote(sn, GridResolution.sixteenths)
    
    result.time shouldBe "0:0:0"
    result.note shouldBe "C4"
    result.duration shouldBe "4n"
    result.velocity shouldBe 0.79 +- 0.01
  }

  it should "convert notes with different positions and grid resolutions" in {
    val sn = SequencedNote(
      note = Note(midiNotePitch = 64, midiNoteVelocity = 80),
      start = Position(2, 3, 2),
      duration = Duration.eighth
    )
    
    val result = ToneNote.fromSequencedNote(sn, GridResolution.sixteenths)
    
    result.time shouldBe "2:3:2"
    result.note shouldBe "E4"
    result.duration shouldBe "8n"
    result.velocity shouldBe 0.63 +- 0.01
  }

  it should "use sixteenths resolution by default" in {
    val sn = SequencedNote(
      note = Note(midiNotePitch = 67, midiNoteVelocity = 127),
      start = Position(1, 2, 3),
      duration = Duration.sixteenth
    )
    
    val result = ToneNote.fromSequencedNote(sn)
    
    result.time shouldBe "1:2:3"
    result.note shouldBe "G4"
    result.duration shouldBe "16n"
    result.velocity shouldBe 1.0
  }

  "ToneNote.velocityToNormalized" should "convert MIDI velocities to normalized values" in {
    val testCases = Table(
      ("midiVelocity", "expectedNormalized", "tolerance"),
      (0, 0.0, 0.001),
      (127, 1.0, 0.001),
      (64, 0.50, 0.01),
      (100, 0.79, 0.01)
    )

    forAll(testCases) { (midiVelocity, expectedNormalized, tolerance) =>
      ToneNote.velocityToNormalized(midiVelocity) shouldBe expectedNormalized +- tolerance
    }
  }

  it should "reject invalid MIDI velocities" in {
    val invalidVelocities = Table("velocity", -1, 128)

    forAll(invalidVelocities) { velocity =>
      an[IllegalArgumentException] should be thrownBy {
        ToneNote.velocityToNormalized(velocity)
      }
    }
  }

  "ToneNote.velocityToMidi" should "convert normalized velocities to MIDI values" in {
    val testCases = Table(
      ("normalizedVelocity", "expectedMidi"),
      (0.0, 0),
      (1.0, 127),
      (0.5, 64)
    )

    forAll(testCases) { (normalizedVelocity, expectedMidi) =>
      ToneNote.velocityToMidi(normalizedVelocity) shouldBe expectedMidi +- 1
    }
  }

  it should "reject invalid normalized velocities" in {
    val invalidVelocities = Table("velocity", -0.1, 1.1)

    forAll(invalidVelocities) { velocity =>
      an[IllegalArgumentException] should be thrownBy {
        ToneNote.velocityToMidi(velocity)
      }
    }
  }

  it should "round-trip velocity conversions accurately" in {
    val testValues = Table("midiVelocity", 0, 32, 64, 96, 127)

    forAll(testValues) { midi =>
      val normalized = ToneNote.velocityToNormalized(midi)
      val backToMidi = ToneNote.velocityToMidi(normalized)
      backToMidi shouldBe midi +- 1
    }
  }
}