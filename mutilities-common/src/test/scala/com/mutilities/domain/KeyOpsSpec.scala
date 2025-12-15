package com.mutilities.domain

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.prop.TableDrivenPropertyChecks

class KeyOpsSpec extends AnyFlatSpec with Matchers with TableDrivenPropertyChecks {

  "quantiseToKey with sequence key" should "do nothing if sequence has no key" in {
    val sequence = NoteSequence(
      notes = List(
        SequencedNote(61, Position.zero, Duration.quarter),
        SequencedNote(63, Position(0, 1), Duration.quarter)
      ),
      length = Position.bar(1),
      key = None
    )
    
    KeyOps.quantiseToKey(sequence) shouldBe sequence
  }

  it should "quantise notes to the sequence's key" in {
    val cMajorKey = Key(PitchClass.C, Scale.Major)
    val sequence = NoteSequence(
      notes = List(
        SequencedNote(61, Position.zero, Duration.quarter),
        SequencedNote(63, Position(0, 1), Duration.quarter),
        SequencedNote(66, Position(0, 2), Duration.quarter)
      ),
      length = Position.bar(1),
      key = Some(cMajorKey)
    )
    
    val result = KeyOps.quantiseToKey(sequence)
    val expectedPitches = List(60, 62, 65)
    result.notes.map(_.note.midiNotePitch) shouldBe expectedPitches
  }

  it should "preserve rhythm and other note properties" in {
    val cMajorKey = Key(PitchClass.C, Scale.Major)
    val sequence = NoteSequence(
      notes = List(SequencedNote(Note(61, 80, 2), Position.zero, Duration.eighth)),
      length = Position.bar(1),
      bpm = 140,
      timeSignature = (3, 4),
      key = Some(cMajorKey)
    )
    
    val result = KeyOps.quantiseToKey(sequence)
    result.notes(0).note.midiNotePitch shouldBe 60
    result.notes(0).note.midiNoteVelocity shouldBe 80
    result.notes(0).note.midiChannel shouldBe 2
    result.notes(0).start shouldBe Position.zero
    result.notes(0).duration shouldBe Duration.eighth
    result.bpm shouldBe 140
    result.timeSignature shouldBe (3, 4)
  }

  "quantiseToKey with explicit key" should "quantise notes to the provided key" in {
    val testCases = Table(
      ("key", "inputPitches", "expectedPitches"),
      (Key(PitchClass.C, Scale.Major), List(61, 63, 66), List(60, 62, 65)),
      (Key(PitchClass.D, Scale.Major), List(60, 61), List(59, 61))
    )

    forAll(testCases) { (key, inputPitches, expectedPitches) =>
      val sequence = NoteSequence(
        notes = inputPitches.zipWithIndex.map { case (pitch, i) =>
          SequencedNote(pitch, Position(0, i), Duration.quarter)
        },
        length = Position.bar(1)
      )
      
      val result = KeyOps.quantiseToKey(sequence, key)
      result.notes.map(_.note.midiNotePitch) shouldBe expectedPitches
    }
  }

  it should "preserve rhythm while adjusting pitch" in {
    val sequence = NoteSequence(
      notes = List(
        SequencedNote(61, Position.zero, Duration.quarter),
        SequencedNote(62, Position(0, 1), Duration.eighth),
        SequencedNote(63, Position(0, 1, 8), Duration.sixteenth)
      ),
      length = Position.bar(1)
    )
    
    val result = KeyOps.quantiseToKey(sequence, Key(PitchClass.C, Scale.Major))
    
    result.notes(0).start shouldBe Position.zero
    result.notes(0).duration shouldBe Duration.quarter
    result.notes(1).start shouldBe Position(0, 1)
    result.notes(1).duration shouldBe Duration.eighth
    result.notes(2).start shouldBe Position(0, 1, 8)
    result.notes(2).duration shouldBe Duration.sixteenth
  }

  "transpose" should "shift all pitches by the specified semitone count" in {
    val testCases = Table(
      ("semitones", "inputPitches", "expectedPitches"),
      (2, List(60, 64, 67), List(62, 66, 69)),
      (-2, List(62, 65, 69), List(60, 63, 67)),
      (0, List(60, 64, 67), List(60, 64, 67))
    )

    forAll(testCases) { (semitones, inputPitches, expectedPitches) =>
      val sequence = NoteSequence(
        notes = inputPitches.zipWithIndex.map { case (pitch, i) =>
          SequencedNote(pitch, Position(0, i), Duration.quarter)
        },
        length = Position.bar(1)
      )
      
      val result = KeyOps.transpose(sequence, semitones)
      result.notes.map(_.note.midiNotePitch) shouldBe expectedPitches
    }
  }

  it should "respect MIDI range boundaries" in {
    val boundaryTests = Table(
      ("inputPitch", "semitones", "expectedPitch"),
      (0, -10, 0),     // Clamp at min
      (0, 10, 10),     // Transpose up
      (127, 10, 127),  // Clamp at max
      (127, -10, 117)  // Transpose down
    )

    forAll(boundaryTests) { (inputPitch, semitones, expectedPitch) =>
      val sequence = NoteSequence(
        notes = List(SequencedNote(inputPitch, Position.zero, Duration.quarter)),
        length = Position.bar(1)
      )
      
      val result = KeyOps.transpose(sequence, semitones)
      result.notes(0).note.midiNotePitch shouldBe expectedPitch
    }
  }

  it should "preserve all other sequence properties" in {
    val sequence = NoteSequence(
      notes = List(SequencedNote(60, Position.zero, Duration.quarter)),
      length = Position.bar(2),
      bpm = 140,
      timeSignature = (3, 4),
      key = Some(Key(PitchClass.C, Scale.Major))
    )
    
    val result = KeyOps.transpose(sequence, 5)
    result.length shouldBe Position.bar(2)
    result.bpm shouldBe 140
    result.timeSignature shouldBe (3, 4)
    result.key shouldBe Some(Key(PitchClass.C, Scale.Major))
  }

  "transposeTo" should "do nothing if sequence has no key" in {
    val sequence = NoteSequence(
      notes = List(
        SequencedNote(60, Position.zero, Duration.quarter),
        SequencedNote(64, Position(0, 1), Duration.quarter)
      ),
      length = Position.bar(1),
      key = None
    )
    
    val targetKey = Key(PitchClass.D, Scale.Major)
    KeyOps.transposeTo(sequence, targetKey) shouldBe sequence
  }

  it should "transpose between keys preserving scale degrees" in {
    val transposeTests = Table(
      ("sourceKey", "targetKey", "inputPitches", "expectedPitches"),
      (Key(PitchClass.C, Scale.Major), Key(PitchClass.D, Scale.Major), List(60, 64, 67), List(62, 66, 69)),
      (Key(PitchClass.D, Scale.Major), Key(PitchClass.C, Scale.Major), List(62, 66, 69), List(60, 64, 67)),
      (Key(PitchClass.A, Scale.Minor), Key(PitchClass.C, Scale.Minor), List(69, 72), List(72, 75)),
      (Key(PitchClass.C, Scale.Major), Key(PitchClass.C, Scale.Major), List(60, 64), List(60, 64))
    )

    forAll(transposeTests) { (sourceKey, targetKey, inputPitches, expectedPitches) =>
      val sequence = NoteSequence(
        notes = inputPitches.zipWithIndex.map { case (pitch, i) =>
          SequencedNote(pitch, Position(0, i), Duration.quarter)
        },
        length = Position.bar(1),
        key = Some(sourceKey)
      )
      
      val result = KeyOps.transposeTo(sequence, targetKey)
      result.notes.map(_.note.midiNotePitch) shouldBe expectedPitches
      result.key shouldBe Some(targetKey)
    }
  }

  it should "preserve rhythm and velocity during key transposition" in {
    val sequence = NoteSequence(
      notes = List(
        SequencedNote(Note(60, 100, 1), Position.zero, Duration.eighth),
        SequencedNote(Note(64, 80, 2), Position(0, 0, 8), Duration.sixteenth)
      ),
      length = Position.bar(1),
      key = Some(Key(PitchClass.C, Scale.Major))
    )
    
    val result = KeyOps.transposeTo(sequence, Key(PitchClass.G, Scale.Major))
    
    result.notes(0).note.midiNoteVelocity shouldBe 100
    result.notes(0).note.midiChannel shouldBe 1
    result.notes(0).start shouldBe Position.zero
    result.notes(0).duration shouldBe Duration.eighth
    
    result.notes(1).note.midiNoteVelocity shouldBe 80
    result.notes(1).note.midiChannel shouldBe 2
    result.notes(1).start shouldBe Position(0, 0, 8)
    result.notes(1).duration shouldBe Duration.sixteenth
  }
}