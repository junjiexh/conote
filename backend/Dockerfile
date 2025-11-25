# Multi-stage build for Spring Boot backend
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

# Copy pom.xml and download dependencies (cached layer)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy proto files (must be copied by Makefile before docker build)
COPY src/main/proto ./src/main/proto

# Copy source code
COPY src ./src

# Generate protobuf code and build (single Maven invocation)
RUN mvn clean package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:17-jre

WORKDIR /app

# Copy the JAR from build stage
COPY --from=build /app/target/*.jar app.jar

# Expose port
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
