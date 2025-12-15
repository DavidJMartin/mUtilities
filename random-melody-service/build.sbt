name := "random-melody-service"

// Dependency versions
val Http4sVersion = "0.23.31"
val CirceVersion = "0.14.10"
val CatsEffectVersion = "3.5.7"
val KafkaVersion = "3.9.0"
val ScalaTestVersion = "3.2.19"

libraryDependencies ++= Seq(
  // Cats Effect for functional IO
  "org.typelevel" %% "cats-effect" % CatsEffectVersion,
  
  // HTTP server and client
  "org.http4s" %% "http4s-ember-server" % Http4sVersion,
  "org.http4s" %% "http4s-ember-client" % Http4sVersion,
  "org.http4s" %% "http4s-circe" % Http4sVersion,
  "org.http4s" %% "http4s-dsl" % Http4sVersion,
  
  // JSON serialization
  "io.circe" %% "circe-generic" % CirceVersion,
  "io.circe" %% "circe-parser" % CirceVersion,
  
  // Kafka for async messaging
  "org.apache.kafka" % "kafka-clients" % KafkaVersion,
  
  // Testing
  "org.scalatest" %% "scalatest" % ScalaTestVersion % Test
)

// Assembly settings for building fat JAR
assembly / mainClass := Some("com.mutilities.melody.Main")
assembly / assemblyJarName := "random-melody-service.jar"

// Docker settings for containerization
enablePlugins(JavaAppPackaging, DockerPlugin)

Docker / packageName := "random-melody-service"
Docker / version := version.value
Docker / dockerExposedPorts := Seq(8080)
Docker / dockerBaseImage := "eclipse-temurin:21-jre"
