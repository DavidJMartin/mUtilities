# mUtilities - Music Inspiration Tools

A collection of inspiring music tools built as a web interface with Scala backend microservices.

The name might change.

## Planned tools

### Musical Key Reference
Interface showing keyboard, guitar and midi note display to help with improvising in key.

### Drone synth
Playing a drone or soundscape within a key can often assist with writing melodies. This tool should allow you to generate and modify the soundscape while it plays.

### Algorithmic rhythm generator
Experience with modular synths and sequencers has made me appreciate algorithmic methods of building rhythms, this will include euclidean and polyrhythmic generators.

### Melody generation
Backend services to generate melodies using different techniques. Web interface should allow parameters to influence this generation.

## Getting Started

### Prerequisites
- Java 21+
- SBT 1.10+
- Docker & Docker Compose

### Run with Docker Compose

```bash
# Build and start all services
docker-compose up --build

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Access Service locally

http://localhost

## Technology Stack

- **Backend**: Scala 3
- **HTTP**: http4s 
- **JSON**: Circe
- **Messaging**: Kafka [Not yet used]
- **Database**: PostgreSQL [Not yet used]
- **Frontend**: HTML/CSS/JavaScript
- **Web Server**: Nginx
- **Build**: SBT with Assembly & Docker plugins

## Architecture

### Microservices Pattern
- **Independent modules**: Each service has its own `build.sbt` for maximum independence
- **Shared common library**: Common code, models, and utilities in `mutilities-common`
- **Communication**: Services communicate via HTTP/gRPC or Kafka
- **Frontend**: Static files served by nginx, proxies API calls to microservices

### Infrastructure Components
- **Nginx**: Serves UI and reverse proxies API requests
- **PostgreSQL**: Shared database for persistent storage [Not yet used]
- **Kafka + Zookeeper**: Message broker for async communication between services [Not yet used]

## A Note on Generative AI
My plan is for these tools to inspire creativity, provide theoretical assistance and to be fun!

Part of the reason for this project is to practice my own software engineering skills while making use of coding agents.
The other half is creating tools that I'd like to use.

I do not support the use of AI to generate art and the tools provided will not facilitate this. It may use rudimentary AI techniques to melodic or rhythmic ideas but the intention is for these to spark creativity.