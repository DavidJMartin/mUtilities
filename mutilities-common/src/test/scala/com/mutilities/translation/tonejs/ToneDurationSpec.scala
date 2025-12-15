package com.mutilities.translation.tonejs

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.prop.TableDrivenPropertyChecks
import com.mutilities.domain.Duration

class ToneDurationSpec extends AnyFlatSpec with Matchers with TableDrivenPropertyChecks {

  "ToneDuration.fromDuration" should "convert standard note durations" in {
    val standardDurations = Table(
      ("duration", "expectedNotation"),
      (Duration.whole, "1n"),
      (Duration.half, "2n"),
      (Duration.quarter, "4n"),
      (Duration.eighth, "8n"),
      (Duration.sixteenth, "16n"),
      (Duration.thirtySecond, "32n")
    )

    forAll(standardDurations) { (duration, expectedNotation) =>
      ToneDuration.fromDuration(duration) shouldBe expectedNotation
    }
  }

  it should "convert dotted note durations" in {
    val dottedDurations = Table(
      ("duration", "expectedNotation"),
      (Duration.dottedHalf, "2n."),
      (Duration.dottedQuarter, "4n."),
      (Duration.dottedEighth, "8n.")
    )

    forAll(dottedDurations) { (duration, expectedNotation) =>
      ToneDuration.fromDuration(duration) shouldBe expectedNotation
    }
  }

  it should "convert triplet durations" in {
    val tripletDurations = Table(
      ("duration", "expectedNotation"),
      (Duration.tripletQuarter, "4t"),
      (Duration.tripletEighth, "8t")
    )

    forAll(tripletDurations) { (duration, expectedNotation) =>
      ToneDuration.fromDuration(duration) shouldBe expectedNotation
    }
  }

  it should "fall back to decimal format for non-standard durations" in {
    val nonStandardDurations = Table(
      ("duration", "expectedResult"),
      (Duration(BigDecimal("2.5")), "2.5"),
      (Duration(BigDecimal("0.0625")), "0.0625")
    )

    forAll(nonStandardDurations) { (duration, expectedResult) =>
      ToneDuration.fromDuration(duration) shouldBe expectedResult
    }
  }

  it should "not include notation markers for non-standard values" in {
    val nonStandard = Duration(BigDecimal("0.333"))
    val result = ToneDuration.fromDuration(nonStandard)
    result should not include "n"
    result should not include "t"
  }
}