# Conote - Multi-User Document Editor

A full-stack web application for creating and managing hierarchical documents with a tree-like structure.

## Features

- User authentication (registration and login)
- Hierarchical document structure (documents can have parent-child relationships)
- Real-time document editing
- Collapsible tree view
- Document operations:
  - Create root documents
  - Create child documents
  - Rename documents
  - Delete documents
  - Move documents (change parent)
- Auto-save functionality with Ctrl+S keyboard shortcut
- Responsive UI with Tailwind CSS

## Technology Stack

### Backend
- **Framework**: Spring Boot 3.2.0 (Java REST API)
- **Database**: PostgreSQL
- **Security**: Spring Security with JWT authentication
- **ORM**: Spring Data JPA with Hibernate
- **Build Tool**: Maven

### Account Service (Microservice)
- **Language**: Go 1.25
- **Framework**: gRPC
- **Authentication**: JWT token validation
- **Database**: PostgreSQL
- **Build Tool**: Make

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS

### Shared
- **API Definition**: Protocol Buffers (gRPC)
- **Code Generation**: `proto/` directory with unified Makefile

## Architecture

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Documents Table
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    parent_id UUID,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_parent FOREIGN KEY(parent_id) REFERENCES documents(id) ON DELETE SET NULL
);
```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Create a new user account
- `POST /api/auth/login` - Login and receive JWT token

#### Documents (Protected)
- `GET /api/documents` - Get all documents as a hierarchical tree
- `GET /api/documents/{id}` - Get a single document
- `POST /api/documents` - Create a new document
- `PUT /api/documents/{id}` - Update document title and content
- `PATCH /api/documents/{id}/move` - Move document to a new parent
- `DELETE /api/documents/{id}` - Delete a document

## Development

### Protocol Buffer Code Generation

To generate gRPC client/server code from proto definitions:

```bash
cd proto
make        # Generate for all languages (Go + Java)
make go     # Generate Go code only
make java   # Generate Java code only
make clean  # Remove all generated code
```

See [proto/README.md](proto/README.md) for more details.

## Setup and Installation

### Quick Start with Docker (Recommended)

The easiest way to run Conote is using Docker Compose. This will start all services (database, backend, and frontend) with a single command.

#### Prerequisites
- Docker Desktop or Docker Engine 20.10+
- Docker Compose 2.0+

#### Steps

1. Clone the repository:
```bash
git clone <repository-url>
cd conote
```

2. (Optional) Customize environment variables:
```bash
cp .env.example .env
# Edit .env with your preferred settings
```

3. Start all services:
```bash
docker-compose up -d
```

4. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- PostgreSQL: localhost:5432

5. View logs:
```bash
docker-compose logs -f
```

6. Stop all services:
```bash
docker-compose down
```

7. Stop and remove all data (including database):
```bash
docker-compose down -v
```

#### Docker Environment Variables

You can customize the deployment by editing the `.env` file:

- `POSTGRES_DB` - Database name (default: conote)
- `POSTGRES_USER` - Database user (default: postgres)
- `POSTGRES_PASSWORD` - Database password (default: postgres)
- `JWT_SECRET` - JWT signing secret (change in production!)
- `JWT_EXPIRATION` - JWT token expiration in milliseconds (default: 86400000 = 24 hours)
- `CORS_ALLOWED_ORIGINS` - Comma-separated list of allowed origins
- `VITE_API_URL` - Backend API URL for frontend (default: http://localhost:8080/api)

### Manual Setup (Without Docker)

#### Prerequisites
- Java 17 or higher
- Node.js 18 or higher
- PostgreSQL 14 or higher
- Maven 3.6 or higher

### Database Setup

1. Install PostgreSQL and create a database:
```bash
createdb conote
```

2. Run the schema creation script:
```bash
psql -d conote -f backend/src/main/resources/schema.sql
```

Or the database will be created automatically if you configure `spring.jpa.hibernate.ddl-auto=create` in application.properties (not recommended for production).

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Update database credentials in `src/main/resources/application.properties`:
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/conote
spring.datasource.username=your_username
spring.datasource.password=your_password
jwt.secret=your-secret-key-at-least-256-bits-long
```

3. Build and run the application:
```bash
mvn clean install
mvn spring-boot:run
```

The backend will start on `http://localhost:8080`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will start on `http://localhost:3000`

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Register a new account or login with existing credentials
3. Create your first document by clicking "New Document"
4. Click on a document to edit it
5. Use the menu (⋮) next to each document to:
   - Add child documents
   - Rename documents
   - Delete documents
6. Save changes using the Save button or Ctrl+S

## Project Structure

```
conote/
├── backend/
│   ├── src/
│   │   └── main/
│   │       ├── java/com/conote/
│   │       │   ├── controller/     # REST controllers
│   │       │   ├── dto/           # Data transfer objects
│   │       │   ├── model/         # Entity classes
│   │       │   ├── repository/    # JPA repositories
│   │       │   ├── security/      # Security configuration and JWT
│   │       │   └── service/       # Business logic
│   │       └── resources/
│   │           ├── application.properties
│   │           └── schema.sql
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── context/          # React context (Auth)
│   │   ├── pages/            # Page components
│   │   ├── services/         # API client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Security Features

- Password hashing with BCrypt
- JWT-based authentication
- Protected API endpoints
- CORS configuration for frontend-backend communication
- User data isolation (users can only access their own documents)

## Future Enhancements

- Rich text editing with markdown support
- Document sharing and collaboration
- Real-time collaboration with WebSockets
- Document versioning and history
- Search functionality
- Tags and categories
- Export documents to various formats (PDF, Markdown, etc.)
- Drag-and-drop document reordering

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
