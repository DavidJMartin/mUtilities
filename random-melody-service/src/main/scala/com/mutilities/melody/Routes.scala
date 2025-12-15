package com.mutilities.melody

import cats.effect.IO
import io.circe.syntax.*
import org.http4s.HttpRoutes
import org.http4s.circe.*
import org.http4s.dsl.io.*

object Routes:
  
  val routes: HttpRoutes[IO] = HttpRoutes.of[IO] {
    
    // Health check endpoint
    case GET -> Root / "health" =>
      Ok("OK")
    
    // Generate melody endpoint (placeholder)
    case POST -> Root / "generate" =>
      // TODO: Implement melody generation logic
      Ok(Map("message" -> "Melody generation not yet implemented").asJson)
    
    // Get service info
    case GET -> Root =>
      Ok(Map(
        "service" -> "Random Melody Service",
        "version" -> "0.1.0-SNAPSHOT",
        "status" -> "running"
      ).asJson)
  }