package com.mutilities.domain

opaque type PitchClass = Int

object PitchClass {
  def apply(semitone: Int): PitchClass = {
    val normalized = semitone % 12
    if (normalized < 0) normalized + 12 else normalized
  }

  // Natural notes and sharps
  val C: PitchClass = 0
  val Cs: PitchClass = 1
  val D: PitchClass = 2
  val Ds: PitchClass = 3
  val E: PitchClass = 4
  val F: PitchClass = 5
  val Fs: PitchClass = 6
  val G: PitchClass = 7
  val Gs: PitchClass = 8
  val A: PitchClass = 9
  val As: PitchClass = 10
  val B: PitchClass = 11

  // Flat aliases
  val Db: PitchClass = Cs
  val Eb: PitchClass = Ds
  val Gb: PitchClass = Fs
  val Ab: PitchClass = Gs
  val Bb: PitchClass = As

  def fromMidiPitch(pitch: Int): PitchClass = apply(pitch % 12)

  extension (pc: PitchClass)
    def semitone: Int = pc
}