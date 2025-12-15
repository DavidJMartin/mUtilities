package com.mutilities.translation.tonejs

import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import com.mutilities.domain.{Note, Position, Duration, SequencedNote, NoteSequence, GridResolution}
import io.circe.parser.*
import ToneJsonCodecs.given
import ToneJsonCodecs.*

class ToneSequenceSpec extends AnyFlatSpec with Matchers {

  "ToneSequence.fromNoteSequence" should "convert an empty note sequence" in {
    val ns = NoteSequence.empty(4)
    
    val result = ToneSequence.fromNoteSequence(ns)
    
    result.bpm shouldBe 120
    result.timeSignature shouldBe (4, 4)
    result.length shouldBe "4:0:0"
    result.notes shouldBe empty
  }

  it should "convert a note sequence with notes" in {
    val ns = NoteSequence(
      notes = List(
        SequencedNote(Note(60, 100), Position(0, 0, 0), Duration.eighth),
        SequencedNote(Note(64, 100), Position(0, 0, 2), Duration.eighth)
      ),
      length = Position.bar(4),
      bpm = 120,
      timeSignature = (4, 4),
      gridResolution = GridResolution.sixteenths
    )
    
    val result = ToneSequence.fromNoteSequence(ns)
    
    result.bpm shouldBe 120
    result.timeSignature shouldBe (4, 4)
    result.length shouldBe "4:0:0"
    result.notes should have size 2
    result.notes(0).time shouldBe "0:0:0"
    result.notes(0).note shouldBe "C4"
    result.notes(1).time shouldBe "0:0:2"
    result.notes(1).note shouldBe "E4"
  }

  it should "preserve custom BPM and time signature" in {
    val ns = NoteSequence(
      notes = List.empty,
      length = Position.bar(8),
      bpm = 140,
      timeSignature = (3, 4),
      gridResolution = GridResolution.triplets
    )
    
    val result = ToneSequence.fromNoteSequence(ns)
    
    result.bpm shouldBe 140
    result.timeSignature shouldBe (3, 4)
    result.length shouldBe "8:0:0"
  }

  "ToneSequence.empty" should "create an empty sequence with defaults" in {
    val result = ToneSequence.empty()
    
    result.bpm shouldBe 120
    result.timeSignature shouldBe (4, 4)
    result.length shouldBe "4:0:0"
    result.notes shouldBe empty
  }

  it should "accept custom parameters" in {
    val result = ToneSequence.empty(bpm = 90, timeSignature = (6, 8), bars = 16)
    
    result.bpm shouldBe 90
    result.timeSignature shouldBe (6, 8)
    result.length shouldBe "16:0:0"
  }

  "ToneSequence JSON serialisation" should "produce valid JSON structure" in {
    val seq = ToneSequence(
      bpm = 120,
      timeSignature = (4, 4),
      length = "4:0:0",
      notes = List(
        ToneNote("0:0:0", "C4", "8n", 0.78),
        ToneNote("0:0:2", "E4", "8n", 0.78)
      )
    )
    
    val json = seq.toJsonString
    val parsed = parse(json)
    
    parsed.isRight shouldBe true
    
    val cursor = parsed.toOption.get.hcursor
    cursor.downField("bpm").as[Int] shouldBe Right(120)
    cursor.downField("timeSignature").as[List[Int]] shouldBe Right(List(4, 4))
    cursor.downField("length").as[String] shouldBe Right("4:0:0")
    
    val notes = cursor.downField("notes").as[List[io.circe.Json]]
    notes.isRight shouldBe true
    notes.toOption.get should have size 2
  }

  it should "produce pretty-printed JSON" in {
    val seq = ToneSequence.empty()
    val prettyJson = seq.toJsonStringPretty
    
    prettyJson should include("\n")
  }

  "ToneNote JSON serialisation" should "produce valid JSON" in {
    val note = ToneNote("0:0:0", "C4", "8n", 0.78)
    val json = note.toJsonString
    
    json shouldBe """{"time":"0:0:0","note":"C4","duration":"8n","velocity":0.78}"""
  }

  "Full domain to Tone.js conversion" should "produce valid JSON" in {
    val ns = NoteSequence(
      notes = List(
        SequencedNote(Note(60, 100), Position(0, 0, 0), Duration.eighth),
        SequencedNote(Note(64, 100), Position(0, 0, 2), Duration.eighth)
      ),
      length = Position.bar(4),
      bpm = 120,
      timeSignature = (4, 4),
      gridResolution = GridResolution.sixteenths
    )
    
    val toneSeq = ToneSequence.fromNoteSequence(ns)
    val json = toneSeq.toJsonStringPretty
    
    json should include("\"bpm\" : 120")
    json should include("\"length\" : \"4:0:0\"")
    json should include("\"note\" : \"C4\"")
  }
}