package com.mutilities.domain

enum Scale(val intervals: List[Int]) {
  case Major extends Scale(List(0, 2, 4, 5, 7, 9, 11))
  case Minor extends Scale(List(0, 2, 3, 5, 7, 8, 10))
  case Dorian extends Scale(List(0, 2, 3, 5, 7, 9, 10))
  case Phrygian extends Scale(List(0, 1, 3, 5, 7, 8, 10))
  case Lydian extends Scale(List(0, 2, 4, 6, 7, 9, 11))
  case Mixolydian extends Scale(List(0, 2, 4, 5, 7, 9, 10))
  case Locrian extends Scale(List(0, 1, 3, 5, 6, 8, 10))
  case HarmonicMinor extends Scale(List(0, 2, 3, 5, 7, 8, 11))
  case MelodicMinor extends Scale(List(0, 2, 3, 5, 7, 9, 11))
  case PentatonicMajor extends Scale(List(0, 2, 4, 7, 9))
  case PentatonicMinor extends Scale(List(0, 3, 5, 7, 10))
  case Blues extends Scale(List(0, 3, 5, 6, 7, 10))
}