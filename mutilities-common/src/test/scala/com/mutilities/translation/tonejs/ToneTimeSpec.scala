package com.mutilities.translation.tonejs

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.prop.TableDrivenPropertyChecks
import com.mutilities.domain.{Position, GridResolution}

class ToneTimeSpec extends AnyFlatSpec with Matchers with TableDrivenPropertyChecks {

  "ToneTime.fromPosition" should "convert positions to transport time format" in {
    val testCases = Table(
      ("position", "gridResolution", "expectedTime"),
      // Basic positions
      (Position(0, 0, 0), GridResolution.sixteenths, "0:0:0"),
      (Position(0, 1, 2), GridResolution.sixteenths, "0:1:2"),
      (Position(2, 3, 1), GridResolution.sixteenths, "2:3:1"),
      (Position(16, 2, 3), GridResolution.sixteenths, "16:2:3"),
      // Different grid resolutions
      (Position(1, 2, 2), GridResolution.triplets, "1:2:2"),
      (Position(3, 1, 7), GridResolution.thirtySeconds, "3:1:7"),
      // Position helpers
      (Position.zero, GridResolution.sixteenths, "0:0:0"),
      (Position.bar(4), GridResolution.sixteenths, "4:0:0")
    )

    forAll(testCases) { (position, gridResolution, expectedTime) =>
      ToneTime.fromPosition(position, gridResolution) shouldBe expectedTime
    }
  }

  it should "use sixteenths as default resolution" in {
    ToneTime.fromPosition(Position(1, 2, 3)) shouldBe "1:2:3"
    ToneTime.fromPosition(Position.zero) shouldBe "0:0:0"
    ToneTime.fromPosition(Position.bar(4)) shouldBe "4:0:0"
  }
}