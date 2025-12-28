name := "melody-generation-service"
scalaVersion := "3.7.4"

// Dependency versions
val Http4sVersion = "0.23.31"
val TapirVersion = "1.11.11"
val CirceVersion = "0.14.10"
val CatsEffectVersion = "3.5.7"
val KafkaVersion = "3.9.0"
val ScalaTestVersion = "3.2.19"

libraryDependencies ++= Seq(
  // Cats Effect for functional IO
  "org.typelevel" %% "cats-effect" % CatsEffectVersion,
  
  // HTTP server
  "org.http4s" %% "http4s-ember-server" % Http4sVersion,
  "org.http4s" %% "http4s-ember-client" % Http4sVersion,
  
  // Tapir for API endpoints
  "com.softwaremill.sttp.tapir" %% "tapir-http4s-server" % TapirVersion,
  "com.softwaremill.sttp.tapir" %% "tapir-json-circe" % TapirVersion,
  
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
assembly / assemblyJarName := "melody-generation-service.jar"

// Docker settings for containerization
enablePlugins(JavaAppPackaging, DockerPlugin)

Docker / packageName := "melody-generation-service"
Docker / version := version.value
Docker / dockerExposedPorts := Seq(8080)
Docker / dockerBaseImage := "eclipse-temurin:21-jre"
