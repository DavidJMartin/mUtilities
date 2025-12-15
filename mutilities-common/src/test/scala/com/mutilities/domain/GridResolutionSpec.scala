package com.mutilities.domain

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.prop.TableDrivenPropertyChecks

class GridResolutionSpec extends AnyFlatSpec with Matchers with TableDrivenPropertyChecks {

  "GridResolution" should "provide correct predefined values" in {
    val predefinedValues = Table(
      ("resolution", "expectedSubdivisions"),
      (GridResolution.sixteenths, 4),
      (GridResolution.triplets, 3),
      (GridResolution.thirtySeconds, 8),
      (GridResolution.tripletSixteenths, 6)
    )

    forAll(predefinedValues) { (resolution, expectedSubdivisions) =>
      resolution.subdivisionsPerBeat shouldBe expectedSubdivisions
    }
  }

  it should "allow custom values" in {
    val custom = GridResolution(12)
    custom.subdivisionsPerBeat shouldBe 12
  }
}