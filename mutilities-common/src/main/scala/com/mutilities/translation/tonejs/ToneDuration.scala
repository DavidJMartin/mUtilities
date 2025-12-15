package com.mutilities.translation.tonejs

import com.mutilities.domain.Duration

object ToneDuration {

  import Duration.*

  // Standard duration mappings (beats -> notation)
  private val standardDurations: Map[BigDecimal, String] = Map(
    BigDecimal(4) -> "1n",       // whole note
    BigDecimal(2) -> "2n",       // half note
    BigDecimal(1) -> "4n",       // quarter note
    BigDecimal(0.5) -> "8n",     // eighth note
    BigDecimal(0.25) -> "16n",   // sixteenth note
    BigDecimal(0.125) -> "32n"   // thirty-second note
  )

  // Dotted duration mappings
  private val dottedDurations: Map[BigDecimal, String] = Map(
    BigDecimal(6) -> "1n.",      // dotted whole note
    BigDecimal(3) -> "2n.",      // dotted half note
    BigDecimal(1.5) -> "4n.",    // dotted quarter note
    BigDecimal(0.75) -> "8n.",   // dotted eighth note
    BigDecimal(0.375) -> "16n.", // dotted sixteenth note
    BigDecimal(0.1875) -> "32n." // dotted thirty-second note
  )

  // Triplet duration mappings (2/3 of the regular note value)
  private val tripletDurations: Map[BigDecimal, String] = Map(
    BigDecimal(2) / BigDecimal(3) -> "4t",         // quarter triplet
    BigDecimal(1) / BigDecimal(3) -> "8t",         // eighth triplet
    BigDecimal(1) / BigDecimal(6) -> "16t",        // sixteenth triplet
    BigDecimal(8) / BigDecimal(3) -> "2t",         // half triplet
    BigDecimal(4) / BigDecimal(3) -> "4t",         // whole triplet (equals 4/3)
    BigDecimal(1) / BigDecimal(12) -> "32t"        // thirty-second triplet
  )

  // Combined lookup map
  private val allDurations: Map[BigDecimal, String] =
    standardDurations ++ dottedDurations ++ tripletDurations

  def fromDuration(duration: Duration): String = {
    val beats = duration.beats
    
    // Look up in the duration map, using approximate comparison for BigDecimal
    allDurations
      .find { case (value, _) => isApproximatelyEqual(beats, value) }
      .map(_._2)
      .getOrElse(formatDecimal(beats))
  }

  private def isApproximatelyEqual(a: BigDecimal, b: BigDecimal): Boolean = {
    val epsilon = BigDecimal("0.000001")
    (a - b).abs < epsilon
  }

  private def formatDecimal(value: BigDecimal): String = {
    // Remove trailing zeros and unnecessary decimal point
    val scaled = value.setScale(6, scala.math.BigDecimal.RoundingMode.HALF_UP)
    val str = scaled.toString
    
    // Clean up trailing zeros after decimal point
    if (str.contains(".")) {
      str.reverse.dropWhile(_ == '0').dropWhile(_ == '.').reverse
    } else {
      str
    }
  }
}