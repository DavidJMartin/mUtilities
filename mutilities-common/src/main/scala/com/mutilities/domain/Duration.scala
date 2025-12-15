package com.mutilities.domain

opaque type Duration = BigDecimal

object Duration {
  def apply(beats: BigDecimal): Duration = beats

  val whole: Duration = BigDecimal(4)
  val half: Duration = BigDecimal(2)
  val quarter: Duration = BigDecimal(1)
  val eighth: Duration = BigDecimal(0.5)
  val sixteenth: Duration = BigDecimal(0.25)
  val thirtySecond: Duration = BigDecimal(0.125)
  val dottedHalf: Duration = BigDecimal(3)
  val dottedQuarter: Duration = BigDecimal(1.5)
  val dottedEighth: Duration = BigDecimal(0.75)
  val tripletQuarter: Duration = BigDecimal(2) / BigDecimal(3)
  val tripletEighth: Duration = BigDecimal(1) / BigDecimal(3)

  extension (d: Duration)
    def beats: BigDecimal = d
}