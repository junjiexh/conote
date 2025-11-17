# Account Service

A Go-based microservice for handling user authentication and account management via gRPC.

## Features

- User registration with password validation
- Login with account lockout protection (5 failed attempts = 30 min lockout)
- JWT token generation and validation
- Password reset functionality
- gRPC API for inter-service communication

## Architecture

The account service is a standalone Go application that:
1. Connects directly to the PostgreSQL database (shared with backend)
2. Handles all authentication logic
3. Exposes gRPC endpoints for the backend to consume
4. Generates and validates JWT tokens

## Technology Stack

- **Language**: Go 1.21
- **Protocol**: gRPC / Protocol Buffers
- **Database**: PostgreSQL
- **Authentication**: JWT (HS256)
- **Password Hashing**: bcrypt

## Project Structure

```
account-service/
├── cmd/
│   └── server/          # Main application entry point
├── internal/
│   ├── config/          # Configuration management
│   ├── jwt/             # JWT token generation and validation
│   ├── models/          # Data models
│   ├── repository/      # Database access layer
│   └── service/         # Business logic
├── pkg/
│   └── grpc/            # gRPC server implementation
├── proto/               # Protocol buffer definitions
├── Dockerfile           # Docker build configuration
├── Makefile            # Build commands
├── go.mod              # Go module dependencies
└── go.sum              # Dependency checksums
```

## API Endpoints (gRPC)

### Authentication
- `Register(email, password)` - Create new user account
- `Login(email, password)` - Authenticate and get JWT token
- `ValidateToken(token)` - Verify JWT token validity

### Password Management
- `RequestPasswordReset(email)` - Initiate password reset
- `ConfirmPasswordReset(token, newPassword)` - Complete password reset

### User Management
- `GetUser(userId)` - Retrieve user information
- `UpdateUser(userId, email, role)` - Update user details

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `0.0.0.0` | Server bind address |
| `SERVER_PORT` | `50051` | gRPC server port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `conote` | Database user |
| `DB_PASSWORD` | `conote123` | Database password |
| `DB_NAME` | `conote_db` | Database name |
| `JWT_SECRET` | (required) | Secret key for JWT signing |
| `JWT_EXPIRATION_HOURS` | `24` | Token expiration time |
| `MAX_FAILED_ATTEMPTS` | `5` | Failed login limit |
| `LOCKOUT_DURATION_MINUTES` | `30` | Account lockout duration |
| `PASSWORD_MIN_LENGTH` | `8` | Minimum password length |

## Development

### Prerequisites
- Go 1.21+
- Protocol Buffers compiler (`protoc`)
- PostgreSQL 15+

### Generate Protobuf Code
```bash
make proto
```

### Build
```bash
make build
```

### Run
```bash
make run
```

## Docker

Build and run with Docker:
```bash
docker build -t conote-account-service .
docker run -p 50051:50051 conote-account-service
```

Or use docker-compose (from project root):
```bash
docker-compose up account-service
```

## Security Features

1. **Password Validation**
   - Minimum 8 characters
   - Must contain uppercase letter
   - Must contain lowercase letter
   - Must contain digit

2. **Account Lockout**
   - Tracks failed login attempts
   - Locks account after 5 failures
   - 30-minute lockout period

3. **JWT Tokens**
   - HMAC-SHA256 signing
   - Configurable expiration
   - Contains user ID, email, and role

4. **Password Reset**
   - UUID-based reset tokens
   - 1-hour token expiration
   - Secure token validation

## Integration with Backend

The Spring Boot backend communicates with the account service via gRPC:

1. All authentication requests are forwarded to account service
2. JWT tokens are validated on each request
3. User management operations are delegated to account service

Backend configuration:
```properties
grpc.client.account-service.address=static://account-service:50051
grpc.client.account-service.negotiationType=PLAINTEXT
```
