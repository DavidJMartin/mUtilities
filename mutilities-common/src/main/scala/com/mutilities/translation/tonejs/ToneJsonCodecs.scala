package com.mutilities.translation.tonejs

import io.circe.{Encoder, Json}
import io.circe.syntax.*

object ToneJsonCodecs {

  given Encoder[ToneNote] = Encoder.instance { note =>
    Json.obj(
      "time" -> Json.fromString(note.time),
      "note" -> Json.fromString(note.note),
      "duration" -> Json.fromString(note.duration),
      "velocity" -> Json.fromDoubleOrNull(note.velocity)
    )
  }

  given Encoder[ToneSequence] = Encoder.instance { seq =>
    Json.obj(
      "bpm" -> Json.fromInt(seq.bpm),
      "timeSignature" -> Json.arr(
        Json.fromInt(seq.timeSignature._1),
        Json.fromInt(seq.timeSignature._2)
      ),
      "length" -> Json.fromString(seq.length),
      "notes" -> Json.arr(seq.notes.map(_.asJson)*)
    )
  }

  extension (note: ToneNote) {
    def toJsonString: String = note.asJson.noSpaces
    def toJsonStringPretty: String = note.asJson.spaces2
  }

  extension (seq: ToneSequence) {
    def toJsonString: String = seq.asJson.noSpaces
    def toJsonStringPretty: String = seq.asJson.spaces2
  }
}