package com.mutilities.domain

case class Key(root: PitchClass, scale: Scale) {
  
  def pitchClasses: List[PitchClass] = 
    scale.intervals.map(interval => PitchClass((root.semitone + interval) % 12))
  
  def containsPitch(pitch: Int): Boolean = {
    val pitchClass = PitchClass.fromMidiPitch(pitch)
    pitchClasses.contains(pitchClass)
  }
  
  def nearestInKey(pitch: Int): Int = {
    val keyPitchClasses = pitchClasses.map(_.semitone).toSet
    
    // Generate all possible in-key pitches within a reasonable range
    // (a few octaves around the target pitch to handle edge cases)
    val octave = pitch / 12
    val inKeyPitches = for {
      oct <- (octave - 1) to (octave + 1)
      pc <- keyPitchClasses
      p = oct * 12 + pc
      if p >= 0 && p <= 127
    } yield p
    
    // Find the nearest, breaking ties by choosing the lower pitch (round down)
    inKeyPitches.minBy(p => (Math.abs(p - pitch), p))
  }
}