package com.mutilities.domain

object KeyOps {
  
  def quantiseToKey(sequence: NoteSequence): NoteSequence = 
    sequence.key match {
      case Some(key) => quantiseToKey(sequence, key)
      case None => sequence
    }
  
  def quantiseToKey(sequence: NoteSequence, key: Key): NoteSequence = {
    val quantisedNotes = sequence.notes.map { sequencedNote =>
      val newPitch = key.nearestInKey(sequencedNote.note.midiNotePitch)
      sequencedNote.copy(
        note = sequencedNote.note.copy(midiNotePitch = newPitch)
      )
    }
    sequence.copy(notes = quantisedNotes)
  }
  
  def transpose(sequence: NoteSequence, semitones: Int): NoteSequence = {
    val transposedNotes = sequence.notes.map { sequencedNote =>
      val newPitch = (sequencedNote.note.midiNotePitch + semitones).max(0).min(127)
      sequencedNote.copy(
        note = sequencedNote.note.copy(midiNotePitch = newPitch)
      )
    }
    sequence.copy(notes = transposedNotes)
  }
  
  def transposeTo(sequence: NoteSequence, targetKey: Key): NoteSequence =
    sequence.key match {
      case Some(sourceKey) =>
        // Calculate semitone difference, normalizing to shortest path (-6 to +6)
        val rawDiff = targetKey.root.semitone - sourceKey.root.semitone
        val semitoneDiff = if (rawDiff > 6) rawDiff - 12
                          else if (rawDiff < -6) rawDiff + 12
                          else rawDiff
        val transposed = transpose(sequence, semitoneDiff)
        transposed.copy(key = Some(targetKey))
      case None => sequence
    }
}