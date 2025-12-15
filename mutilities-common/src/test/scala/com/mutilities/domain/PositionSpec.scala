package com.mutilities.domain

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

class PositionSpec extends AnyFlatSpec with Matchers {

  "A Position" should "be created with bar, beat, and subdivision" in {
    val pos = Position(2, 3, 1)
    pos.bar shouldBe 2
    pos.beat shouldBe 3
    pos.subdivision shouldBe 1
  }

  "Position.zero" should "return position at origin" in {
    val pos = Position.zero
    pos.bar shouldBe 0
    pos.beat shouldBe 0
    pos.subdivision shouldBe 0
  }

  "Position.bar" should "return position at start of specified bar" in {
    val pos = Position.bar(4)
    pos.bar shouldBe 4
    pos.beat shouldBe 0
    pos.subdivision shouldBe 0
  }

  it should "work with bar 0" in {
    Position.bar(0) shouldBe Position.zero
  }
}