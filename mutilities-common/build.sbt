name := "mutilities-common"
scalaVersion := "3.7.4"

// Dependency versions
val CirceVersion = "0.14.10"
val LogbackVersion = "1.5.12"
val ScalaTestVersion = "3.2.19"

libraryDependencies ++= Seq(
  // JSON serialization
  "io.circe" %% "circe-core" % CirceVersion,
  "io.circe" %% "circe-generic" % CirceVersion,
  "io.circe" %% "circe-parser" % CirceVersion,
  
  // Logging
  "ch.qos.logback" % "logback-classic" % LogbackVersion,
  
  // Testing
  "org.scalatest" %% "scalatest" % ScalaTestVersion % Test
)
