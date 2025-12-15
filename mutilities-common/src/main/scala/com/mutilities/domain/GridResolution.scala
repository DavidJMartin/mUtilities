package com.mutilities.domain

opaque type GridResolution = Int

object GridResolution {
  def apply(subdivisions: Int): GridResolution = subdivisions

  val sixteenths: GridResolution = 4
  val triplets: GridResolution = 3
  val thirtySeconds: GridResolution = 8
  val tripletSixteenths: GridResolution = 6

  extension (gr: GridResolution)
    def subdivisionsPerBeat: Int = gr
}