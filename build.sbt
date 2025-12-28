// Global settings shared across all modules
ThisBuild / version := "0.1.0-SNAPSHOT"
ThisBuild / scalaVersion := "3.7.4"
ThisBuild / organization := "com.mutilities"

// Assembly plugin settings to handle merge conflicts
ThisBuild / assemblyMergeStrategy := {
  case PathList("META-INF", xs @ _*) => MergeStrategy.discard
  case "application.conf"            => MergeStrategy.concat
  case "reference.conf"              => MergeStrategy.concat
  case x => MergeStrategy.first
}

// Root project - aggregates all Scala modules
lazy val root = (project in file("."))
  .settings(
    name := "mUtilities",
    publish / skip := true
  )
  .aggregate(
    common,
    melodyGenerationService
  )

// Module references - each module has its own build.sbt
lazy val common = project in file("mutilities-common")
lazy val melodyGenerationService = (project in file("melody-generation-service")).dependsOn(common)

// Note: mutilities-ui is served by nginx (not a Scala project)
