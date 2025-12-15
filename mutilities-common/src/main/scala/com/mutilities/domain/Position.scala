package com.mutilities.domain

case class Position(
    bar: Int,
    beat: Int,
    subdivision: Int = 0
)

object Position {
  val zero: Position = Position(0, 0, 0)

  def bar(n: Int): Position = Position(n, 0, 0)
}