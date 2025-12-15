package com.mutilities.melody

import cats.effect.{IO, IOApp}
import com.comcast.ip4s.*
import org.http4s.ember.server.EmberServerBuilder

object Main extends IOApp.Simple:
  
  def run: IO[Unit] = 
    EmberServerBuilder
      .default[IO]
      .withHost(ipv4"0.0.0.0")
      .withPort(port"8080")
      .withHttpApp(Routes.routes.orNotFound)
      .build
      .use(_ => IO.println("Random Melody Service started on port 8080") *> IO.never)