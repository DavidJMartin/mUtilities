package com.mutilities.domain

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.prop.TableDrivenPropertyChecks

class DurationSpec extends AnyFlatSpec with Matchers with TableDrivenPropertyChecks {

  "Duration" should "provide correct predefined values" in {
    val predefinedValues = Table(
      ("duration", "expectedBeats"),
      // Standard values
      (Duration.whole, BigDecimal(4)),
      (Duration.half, BigDecimal(2)),
      (Duration.quarter, BigDecimal(1)),
      (Duration.eighth, BigDecimal(0.5)),
      (Duration.sixteenth, BigDecimal(0.25)),
      (Duration.thirtySecond, BigDecimal(0.125)),
      // Dotted values
      (Duration.dottedHalf, BigDecimal(3)),
      (Duration.dottedQuarter, BigDecimal(1.5)),
      (Duration.dottedEighth, BigDecimal(0.75)),
      // Triplet values
      (Duration.tripletQuarter, BigDecimal(2) / BigDecimal(3)),
      (Duration.tripletEighth, BigDecimal(1) / BigDecimal(3))
    )

    forAll(predefinedValues) { (duration, expectedBeats) =>
      duration.beats shouldBe expectedBeats
    }
  }

  it should "allow custom values" in {
    val custom = Duration(BigDecimal(2.5))
    custom.beats shouldBe BigDecimal(2.5)
  }
}