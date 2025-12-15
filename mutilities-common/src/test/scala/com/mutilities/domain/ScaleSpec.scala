package com.mutilities.domain

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.prop.TableDrivenPropertyChecks

class ScaleSpec extends AnyFlatSpec with Matchers with TableDrivenPropertyChecks {

  "All scales" should "have correct intervals" in {
    val scaleIntervals = Table(
      ("scale", "expectedIntervals"),
      (Scale.Major, List(0, 2, 4, 5, 7, 9, 11)),
      (Scale.Minor, List(0, 2, 3, 5, 7, 8, 10)),
      (Scale.Dorian, List(0, 2, 3, 5, 7, 9, 10)),
      (Scale.Phrygian, List(0, 1, 3, 5, 7, 8, 10)),
      (Scale.Lydian, List(0, 2, 4, 6, 7, 9, 11)),
      (Scale.Mixolydian, List(0, 2, 4, 5, 7, 9, 10)),
      (Scale.Locrian, List(0, 1, 3, 5, 6, 8, 10)),
      (Scale.HarmonicMinor, List(0, 2, 3, 5, 7, 8, 11)),
      (Scale.MelodicMinor, List(0, 2, 3, 5, 7, 9, 11)),
      (Scale.PentatonicMajor, List(0, 2, 4, 7, 9)),
      (Scale.PentatonicMinor, List(0, 3, 5, 7, 10)),
      (Scale.Blues, List(0, 3, 5, 6, 7, 10))
    )

    forAll(scaleIntervals) { (scale, expectedIntervals) =>
      scale.intervals shouldBe expectedIntervals
    }
  }

  it should "start with 0" in {
    Scale.values.foreach { scale =>
      scale.intervals.head shouldBe 0
    }
  }

  it should "have intervals in ascending order" in {
    Scale.values.foreach { scale =>
      scale.intervals shouldBe scale.intervals.sorted
    }
  }

  it should "have unique intervals" in {
    Scale.values.foreach { scale =>
      scale.intervals.distinct shouldBe scale.intervals
    }
  }

  it should "have intervals less than 12" in {
    Scale.values.foreach { scale =>
      scale.intervals.foreach { interval =>
        interval should be < 12
      }
    }
  }
}