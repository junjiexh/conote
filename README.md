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
- **Framework**: Spring Boot 3.2.0
- **Database**: PostgreSQL
- **Security**: Spring Security with JWT authentication
- **ORM**: Spring Data JPA with Hibernate
- **Build Tool**: Maven

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS

### API Gateway (Kubernetes Deployment)
- **Kong Gateway 3.4**: Handles JWT authentication, rate limiting, and CORS
- **Kong PostgreSQL**: Configuration storage
- **Plugins**: JWT, Request Transformer, CORS, Rate Limiting

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

## Setup and Installation

### Quick Start with Docker (Recommended)

The easiest way to run Conote is using Docker Compose. This will start all services including Kong API Gateway for authentication.

#### Prerequisites
- Docker Desktop or Docker Engine 20.10+
- Docker Compose 2.0+

#### Steps

1. Clone the repository:
```bash
git clone <repository-url>
cd conote
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env if needed (defaults work for local development)
```

3. Start all services (including Kong Gateway):
```bash
docker-compose up -d
```

This starts:
- PostgreSQL (app database)
- Kong PostgreSQL (Kong config database)
- Redis (cache)
- Elasticsearch (search)
- Kong Gateway (API gateway with JWT authentication)
- Backend (Spring Boot)
- Frontend (React)

4. Access the application:
- **Frontend**: http://localhost:3000
- **API (via Kong)**: http://localhost:8000
- **Backend (direct)**: http://localhost:8080
- **Kong Admin**: http://localhost:8001

5. Test authentication:
```bash
# Register user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login and get JWT
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

6. View logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f kong
docker-compose logs -f backend
```

7. Stop all services:
```bash
docker-compose down
```

8. Stop and remove all data (including databases):
```bash
docker-compose down -v
```

#### Local Development Modes

**With Kong (Default)** - Recommended, mirrors production:
```bash
# In .env file:
USE_KONG_AUTH=true
VITE_API_URL=http://localhost:8000

# All requests go through Kong on port 8000
```

**Without Kong** - Direct backend access for debugging:
```bash
# In .env file:
USE_KONG_AUTH=false
VITE_API_URL=http://localhost:8080

# Requests go directly to backend
docker-compose up -d --build backend
```

For detailed local testing guide, see [docs/LOCAL_TESTING_WITH_KONG.md](docs/LOCAL_TESTING_WITH_KONG.md)

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

### Kubernetes Deployment with Kong API Gateway

For production deployments, Conote can be deployed to Kubernetes with Kong API Gateway handling all JWT authentication, allowing backend services to focus on business logic.

#### Prerequisites
- Kubernetes cluster (Kind, Minikube, or cloud provider)
- kubectl configured
- Docker for building images

#### Deploy to Kubernetes

1. **Deploy Kong API Gateway**:
```bash
# Deploy Kong with PostgreSQL and JWT authentication
./scripts/deploy-kong.sh
```

2. **Configure JWT Secret** (must match backend):
```bash
# Update Kong's JWT secret to match backend
./scripts/update-kong-jwt-secret.sh "your-jwt-secret-here"
```

3. **Deploy Backend and Database**:
```bash
# Deploy PostgreSQL, Redis, Elasticsearch, and Backend
kubectl apply -f k8s/postgres-cm1-configmap.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/redis-service.yaml
kubectl apply -f k8s/elasticsearch-deployment.yaml
kubectl apply -f k8s/elasticsearch-service.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
```

4. **Deploy Frontend**:
```bash
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
```

5. **Access the Application**:
- Frontend: http://localhost:30000
- Backend (via Kong): http://localhost:30080
- Kong Admin API: `kubectl port-forward svc/kong-admin 8001:8001`

#### Kong Authentication Flow

1. User logs in via Kong → `/api/auth/login`
2. Backend generates JWT with `iss: conote-issuer`
3. Frontend stores JWT and includes in `Authorization: Bearer <token>` header
4. Kong validates JWT signature and expiration
5. Kong extracts `userId` and `email` claims
6. Kong injects `X-User-Id` and `X-User-Email` headers
7. Backend trusts Kong's headers and loads user context

**Benefits**:
- ✅ Backend services focus on business logic
- ✅ Centralized authentication at API Gateway
- ✅ Rate limiting and request size limiting
- ✅ CORS handling
- ✅ Easy to add new protected routes

For detailed Kong configuration and troubleshooting, see [k8s/kong/README.md](k8s/kong/README.md).

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
- JWT-based authentication (HS256 algorithm)
- Protected API endpoints with Spring Security
- CORS configuration for frontend-backend communication
- User data isolation (users can only access their own documents)
- **Kong Gateway (Kubernetes)**:
  - Centralized JWT validation at API Gateway level
  - Rate limiting (100 requests/min, 1000/hour)
  - Request size limiting (10MB)
  - Automatic header injection for user context

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
