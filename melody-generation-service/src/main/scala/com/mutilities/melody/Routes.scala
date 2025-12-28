package com.mutilities.melody

import cats.effect.IO
import io.circe.generic.auto.*
import sttp.tapir.*
import sttp.tapir.generic.auto.*
import sttp.tapir.json.circe.*
import sttp.tapir.server.http4s.Http4sServerInterpreter

object Routes:
  
  // Define case classes for responses
  case class HealthResponse(status: String)
  case class GenerateResponse(message: String)
  case class ServiceInfoResponse(service: String, version: String, status: String)
  
  // Define Tapir endpoints
  val healthEndpoint: PublicEndpoint[Unit, Unit, HealthResponse, Any] = 
    endpoint.get
      .in("health")
      .out(jsonBody[HealthResponse])
      .description("Health check endpoint")
  
  val generateEndpoint: PublicEndpoint[Unit, Unit, GenerateResponse, Any] =
    endpoint.post
      .in("generate")
      .out(jsonBody[GenerateResponse])
      .description("Generate random melody")
  
  val serviceInfoEndpoint: PublicEndpoint[Unit, Unit, ServiceInfoResponse, Any] =
    endpoint.get
      .out(jsonBody[ServiceInfoResponse])
      .description("Get service information")
  
  // Implement endpoint logic
  val healthRoute = healthEndpoint.serverLogicSuccess[IO](_ => 
    IO.pure(HealthResponse("OK"))
  )
  
  val generateRoute = generateEndpoint.serverLogicSuccess[IO](_ =>
    IO.pure(GenerateResponse("Melody generation not yet implemented"))
  )
  
  val serviceInfoRoute = serviceInfoEndpoint.serverLogicSuccess[IO](_ =>
    IO.pure(ServiceInfoResponse(
      service = "Random Melody Service",
      version = "0.1.0-SNAPSHOT",
      status = "running"
    ))
  )
  
  // Convert Tapir endpoints to http4s routes
  val routes = Http4sServerInterpreter[IO]().toRoutes(
    List(
      healthRoute,
      generateRoute,
      serviceInfoRoute
    )
  )