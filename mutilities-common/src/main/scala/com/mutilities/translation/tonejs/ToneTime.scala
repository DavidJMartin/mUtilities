package com.mutilities.translation.tonejs

import com.mutilities.domain.{Position, GridResolution}

object ToneTime {

  def fromPosition(position: Position, gridResolution: GridResolution): String = {
    import GridResolution.*
    s"${position.bar}:${position.beat}:${position.subdivision}"
  }

  def fromPosition(position: Position): String =
    fromPosition(position, GridResolution.sixteenths)
}