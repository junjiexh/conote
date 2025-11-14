# Conote Application Structure Analysis - Privilege System Planning

## Executive Summary
Conote is a Spring Boot-based hierarchical document editor with React frontend. The application currently supports:
- User authentication with JWT
- RBAC with User/Admin roles (currently unused)
- Hierarchical document structure (tree-like with parent-child relationships)
- Full-text search with Elasticsearch
- Redis caching
- PostgreSQL persistence
- Audit logging for security events

**Current Gap**: No document-level sharing or privilege system exists. All documents are private to the user who created them.

---

## 1. BACKEND TECHNOLOGY STACK

### Core Framework
- **Framework**: Spring Boot 3.2.0
- **Language**: Java 17
- **Build Tool**: Maven 3
- **Architecture**: MVC with Service-Repository pattern

### Key Dependencies
```xml
<!-- Core -->
spring-boot-starter-web (REST API)
spring-boot-starter-data-jpa (ORM)
spring-boot-starter-security (Authentication/Authorization)
spring-boot-starter-validation (Input validation)

<!-- Database -->
PostgreSQL driver
spring-boot-starter-data-elasticsearch (Full-text search)
org.flywaydb:flyway-core (Database migrations)

<!-- Security & JWT -->
io.jsonwebtoken:jjwt (JWT library v0.12.3)

<!-- Caching & Performance -->
spring-boot-starter-data-redis (Redis caching)
spring-boot-starter-cache (Cache abstraction)
com.bucket4j:bucket4j-core (Rate limiting)

<!-- Observability -->
spring-boot-starter-actuator (Monitoring)
micrometer-registry-prometheus (Metrics)

<!-- Other -->
org.projectlombok:lombok (Boilerplate reduction)
springdoc-openapi (Swagger UI)
```

---

## 2. DATABASE SCHEMA ANALYSIS

### Current Tables

#### Users Table (`users`)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'USER' NOT NULL,
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked BOOLEAN DEFAULT false,
    locked_until TIMESTAMPTZ,
    password_reset_token VARCHAR(255),
    password_reset_token_expiry TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_account_locked ON users(account_locked);
CREATE INDEX idx_users_reset_token ON users(password_reset_token);
```

**Key Fields for Privilege System**:
- `id`: User identifier
- `role`: Current RBAC roles (USER, ADMIN) - can be extended for document-level roles
- Can be used for ownership tracking

#### Documents Table (`documents`)
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL (FOREIGN KEY to users.id),
    parent_id UUID (FOREIGN KEY to documents.id),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_parent FOREIGN KEY(parent_id) REFERENCES documents(id) ON DELETE SET NULL
);

CREATE INDEX idx_doc_user_id ON documents (user_id);
CREATE INDEX idx_doc_parent_id ON documents (parent_id);
```

**Current Limitation**: All documents are owned by a single `user_id`. No sharing mechanism.

**Missing for Privilege System**:
- No `owner_id` distinct from `user_id` (currently same user can only be owner)
- No permission/sharing table
- No audit trail for permission changes
- No inherited permissions from parent documents

#### Audit Logs Table (`audit_logs`)
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID (FOREIGN KEY to users.id),
    user_email VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_event ON audit_logs(event_type);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
```

**Current Event Types**:
- USER_REGISTRATION, USER_LOGIN_SUCCESS, USER_LOGIN_FAILURE
- PASSWORD_CHANGE, PASSWORD_RESET_*, ACCOUNT_LOCKED, ACCOUNT_UNLOCKED
- DOCUMENT_CREATED, DOCUMENT_UPDATED, DOCUMENT_DELETED
- UNAUTHORIZED_ACCESS_ATTEMPT

#### Elasticsearch Index (`documents`)
```json
{
    "id": "string",
    "userId": "keyword",
    "parentId": "keyword",
    "title": "text",
    "content": "text",
    "createdAt": "date",
    "updatedAt": "date"
}
```

---

## 3. CURRENT API STRUCTURE

### Authentication Endpoints
```
POST   /api/auth/register              - Register new user
POST   /api/auth/login                 - Login (returns JWT)
POST   /api/auth/password-reset/request - Request password reset
POST   /api/auth/password-reset/confirm - Confirm password reset
```

### Document Endpoints (All require JWT)
```
GET    /api/documents                  - Get all documents as tree (current user only)
GET    /api/documents/{id}             - Get single document
POST   /api/documents                  - Create new document
PUT    /api/documents/{id}             - Update document (title/content)
PATCH  /api/documents/{id}/move        - Move document (change parent)
DELETE /api/documents/{id}             - Delete document
POST   /api/documents/search           - Search documents (full-text with pagination)
```

### Security Implementation
- **Authentication**: JWT Bearer token in `Authorization: Bearer {token}` header
- **Default Expiration**: 24 hours (configurable via `jwt.expiration`)
- **Validation**: Custom `JwtAuthenticationFilter` validates token before each request
- **User Context**: Extracted from JWT `subject` field (email)

### Request/Response DTOs

**CreateDocumentRequest**:
```java
{
    "title": "string (required)",
    "parentId": "UUID (optional, null for root)"
}
```

**DocumentTreeNode** (Response):
```java
{
    "id": "UUID",
    "parentId": "UUID",
    "title": "string",
    "content": "string",
    "createdAt": "LocalDateTime",
    "updatedAt": "LocalDateTime",
    "children": [DocumentTreeNode[]]
}
```

**SearchRequest**:
```java
{
    "query": "string",
    "page": "int (0-based)",
    "size": "int (default 20)"
}
```

---

## 4. FRONTEND TECHNOLOGY STACK

### Core
- **Framework**: React 18.2.0
- **Build Tool**: Vite 5.0.8
- **Routing**: React Router v6.20.1
- **HTTP Client**: Axios 1.6.2

### UI Libraries
- **Component Library**: Radix UI (dialog, dropdown, alert-dialog, etc.)
- **Icons**: Lucide React
- **Styling**: Tailwind CSS 3.3.6 + Tailwind Merge
- **Editor**: Lexical (rich text editor) 0.38.2

### Project Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── DocumentTree.jsx          # Tree rendering with drag/drop/rename
│   │   ├── Editor.jsx                # Document editor with auto-save
│   │   ├── LexicalEditor.jsx         # Rich text editor wrapper
│   │   ├── SearchDialog.jsx          # Full-text search dialog
│   │   ├── ProtectedRoute.jsx        # Auth-protected route wrapper
│   │   └── ui/                       # Radix UI component wrappers
│   ├── context/
│   │   └── AuthContext.jsx           # Global auth state (token only)
│   ├── pages/
│   │   ├── Dashboard.jsx             # Main app page
│   │   ├── Login.jsx                 # Login form
│   │   └── Register.jsx              # Registration form
│   ├── services/
│   │   └── api.js                    # Axios instance with JWT interceptor
│   ├── App.jsx                       # Main app with routes
│   └── main.jsx                      # Entry point
```

---

## 5. TREE STRUCTURE IMPLEMENTATION

### Backend
**File**: `/home/user/conote/backend/src/main/java/com/conote/service/DocumentService.java`

**Algorithm** (lines 56-87):
```java
public List<DocumentTreeNode> buildTree(List<Document> documents) {
    // 1. Create map for O(1) lookup: UUID -> DocumentTreeNode
    Map<UUID, DocumentTreeNode> nodeMap = new HashMap<>();
    List<DocumentTreeNode> rootNodes = new ArrayList<>();

    // 2. Convert all documents to nodes
    for (Document doc : documents) {
        DocumentTreeNode node = new DocumentTreeNode();
        // ... populate from document
        nodeMap.put(doc.getId(), node);
    }

    // 3. Build parent-child relationships
    for (DocumentTreeNode node : nodeMap.values()) {
        if (node.getParentId() == null) {
            rootNodes.add(node);  // Root node
        } else {
            DocumentTreeNode parent = nodeMap.get(node.getParentId());
            if (parent != null) {
                parent.getChildren().add(node);  // Add as child
            }
        }
    }

    return rootNodes;
}
```

**Caching**: Redis caching with key `documentTree:{userId}`
- Evicted on: create, update, move, delete operations
- TTL: 10 minutes

**Circular Reference Prevention** (lines 168-189):
```java
private boolean wouldCreateCircularReference(UUID documentId, UUID newParentId, UUID userId) {
    // Traverse up the parent chain
    // If we encounter documentId while traversing, it's circular
}
```

### Frontend
**File**: `/home/user/conote/frontend/src/components/DocumentTree.jsx`

**Component Structure**:
```jsx
DocumentTree
├── TreeNode (recursive, one per document)
│   ├── Collapse/Expand controls
│   ├── Rename functionality (inline edit)
│   ├── Context menu (dropdown) with:
│   │   ├── Add Child
│   │   ├── Rename
│   │   └── Delete (with confirmation)
│   └── Recursive children rendering

// Styling
- Indentation: level * 16px + 8px padding
- Hover effects, active document highlighting
- Truncated titles with ellipsis
```

**Tree Rendering**: Recursive component with state for collapse/expand per node

---

## 6. EXISTING MODELS & ENTITIES

### Core Models
**Location**: `/home/user/conote/backend/src/main/java/com/conote/model/`

#### User.java
```java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    
    @Column(unique = true, nullable = false)
    private String email;
    
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.USER;  // RBAC: USER, ADMIN
    
    // Account lockout fields
    @Column(name = "failed_login_attempts", nullable = false)
    private Integer failedLoginAttempts = 0;
    
    @Column(name = "account_locked")
    private Boolean accountLocked = false;
    
    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;
    
    // Password reset fields
    @Column(name = "password_reset_token")
    private String passwordResetToken;
    
    @Column(name = "password_reset_token_expiry")
    private LocalDateTime passwordResetTokenExpiry;
    
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;
    
    public boolean isAccountLocked() { /* ... */ }
    public boolean isAdmin() { return Role.ADMIN.equals(role); }
}
```

#### Role.java
```java
public enum Role {
    USER,    // Regular user
    ADMIN    // Administrator
}
```

#### Document.java
```java
@Entity
@Table(name = "documents")
public class Document {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;  // Owner of document

    @Column(name = "parent_id")
    private UUID parentId;  // Parent document (null = root)

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
```

#### AuditLog.java
```java
@Entity
@Table(name = "audit_logs")
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "user_email")
    private String userEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false)
    private AuditEventType eventType;

    // Event types include:
    // DOCUMENT_CREATED, DOCUMENT_UPDATED, DOCUMENT_DELETED
    // UNAUTHORIZED_ACCESS_ATTEMPT
    // PASSWORD_CHANGE, PASSWORD_RESET_*, ACCOUNT_LOCKED
}
```

#### DocumentSearchIndex.java (Elasticsearch)
```java
@Document(indexName = "documents")
public class DocumentSearchIndex {
    @Id
    private String id;  // UUID as string
    
    @Field(type = FieldType.Keyword)
    private String userId;  // For filtering by user
    
    @Field(type = FieldType.Keyword)
    private String parentId;
    
    @Field(type = FieldType.Text, analyzer = "standard")
    private String title;
    
    @Field(type = FieldType.Text, analyzer = "html_strip_analyzer")
    private String content;
    
    // Timestamps...
}
```

---

## 7. CURRENT AUTHENTICATION & AUTHORIZATION

### Authentication Flow
1. **Registration** (`AuthService.register()`)
   - Validates password strength
   - Creates User with role=USER
   - Generates JWT token
   - Logs audit event

2. **Login** (`AuthService.login()`)
   - Account lockout check (5 failed attempts = 30-min lock)
   - Authenticates with BCrypt password comparison
   - Updates last_login_at
   - Generates JWT token
   - Logs audit event

3. **JWT Validation** (`JwtAuthenticationFilter`)
   - Extracts token from `Authorization: Bearer {token}` header
   - Validates signature and expiration
   - Sets Spring Security context for request

### Authorization
**Current**: Simple role check in `CustomUserDetailsService`
- No per-document authorization
- No role-based method security
- Document access only via ownership check: `findByIdAndUserId(id, userId)`

### Password Security
- **Hashing**: BCrypt (Spring Security's `BCryptPasswordEncoder`)
- **Reset**: UUID token valid for 1 hour
- **Strength Validation**: Custom `PasswordValidator` (details in `AuthService`)

---

## 8. EXISTING SHARING/PERMISSION SYSTEM

### Status: NONE IMPLEMENTED

**Current Access Control**:
- Users can ONLY access their own documents
- All documents filtered by `user_id`
- No sharing mechanism exists
- No document-level permissions

**What Needs to Be Built**:
- Document sharing (share with specific users)
- Permission levels (View, Edit, Admin)
- Shared document tree integration
- Permission inheritance (parent → children)
- Revocation mechanism
- Permission audit trail

---

## 9. KEY FILE LOCATIONS

### Backend
```
/home/user/conote/backend/
├── src/main/java/com/conote/
│   ├── model/
│   │   ├── User.java                          [EXISTING]
│   │   ├── Document.java                      [NEEDS MODIFICATION]
│   │   ├── Role.java                          [EXISTING, can extend]
│   │   ├── AuditLog.java                      [EXISTING, extend event types]
│   │   └── DocumentSearchIndex.java           [EXISTING]
│   ├── controller/
│   │   ├── AuthController.java                [EXISTING]
│   │   └── DocumentController.java            [NEEDS MODIFICATION]
│   ├── service/
│   │   ├── AuthService.java                   [EXISTING]
│   │   ├── DocumentService.java               [NEEDS MAJOR MODIFICATION]
│   │   ├── AuditLogService.java               [EXISTING, extend]
│   │   └── [NEW] PermissionService.java       [TO CREATE]
│   ├── repository/
│   │   ├── UserRepository.java                [EXISTING]
│   │   ├── DocumentRepository.java            [NEEDS MODIFICATION]
│   │   ├── AuditLogRepository.java            [EXISTING]
│   │   ├── DocumentSearchRepository.java      [EXISTING]
│   │   └── [NEW] DocumentPermissionRepository.java [TO CREATE]
│   ├── security/
│   │   ├── SecurityConfig.java                [EXISTING]
│   │   ├── JwtUtil.java                       [EXISTING]
│   │   ├── JwtAuthenticationFilter.java       [EXISTING]
│   │   ├── CustomUserDetailsService.java      [EXISTING]
│   │   └── [NEW] DocumentAccessValidator.java [TO CREATE]
│   ├── dto/
│   │   ├── CreateDocumentRequest.java         [EXISTING]
│   │   ├── UpdateDocumentRequest.java         [EXISTING]
│   │   ├── DocumentTreeNode.java              [EXISTING]
│   │   └── [NEW] ShareDocumentRequest.java    [TO CREATE]
│   └── exception/
│       ├── UnauthorizedAccessException.java   [EXISTING]
│       ├── ResourceNotFoundException.java     [EXISTING]
│       └── ...
└── src/main/resources/
    ├── application.properties                 [EXISTING, update]
    ├── db/migration/
    │   ├── V1__initial_schema.sql             [EXISTING]
    │   ├── V2__add_composite_indexes.sql      [EXISTING]
    │   ├── V3__add_fulltext_search.sql        [EXISTING]
    │   ├── V4__add_user_security_fields.sql   [EXISTING]
    │   ├── V5__create_audit_logs_table.sql    [EXISTING]
    │   ├── V6__remove_fulltext_search.sql     [EXISTING]
    │   └── [NEW] V7__add_document_permissions.sql [TO CREATE]
```

### Frontend
```
/home/user/conote/frontend/
├── src/
│   ├── components/
│   │   ├── DocumentTree.jsx                   [NEEDS MODIFICATION]
│   │   ├── Editor.jsx                         [EXISTING]
│   │   ├── SearchDialog.jsx                   [EXISTING]
│   │   ├── [NEW] ShareDialog.jsx              [TO CREATE]
│   │   ├── [NEW] PermissionManager.jsx        [TO CREATE]
│   │   └── ProtectedRoute.jsx                 [EXISTING]
│   ├── context/
│   │   ├── AuthContext.jsx                    [EXISTING]
│   │   └── [NEW] PermissionContext.jsx        [TO CREATE]
│   ├── pages/
│   │   └── Dashboard.jsx                      [NEEDS MODIFICATION]
│   ├── services/
│   │   └── api.js                             [NEEDS MODIFICATION]
```

---

## 10. SECURITY CONFIGURATION

**File**: `/home/user/conote/backend/src/main/java/com/conote/security/SecurityConfig.java`

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    // Public endpoints: /api/auth/**, /actuator/health
    // Protected: All others require authentication
    
    // Stateless session (JWT)
    SessionCreationPolicy.STATELESS
    
    // Password encoding: BCryptPasswordEncoder (strength 10)
    
    // CORS: Configurable via cors.allowed-origins
}
```

---

## 11. INFRASTRUCTURE & DEPLOYMENT

### Configuration
**File**: `/home/user/conote/backend/src/main/resources/application.properties`

```properties
# Database
spring.datasource.url=${DATABASE_URL:jdbc:postgresql://localhost:5432/conote}
spring.datasource.username=${DATABASE_USERNAME:postgres}
spring.datasource.password=${DATABASE_PASSWORD:postgres}

# Redis (Caching)
spring.data.redis.host=${REDIS_HOST:localhost}
spring.data.redis.port=${REDIS_PORT:6379}

# Elasticsearch (Full-text search)
spring.elasticsearch.uris=${ELASTICSEARCH_URIS:http://localhost:9200}

# JWT
jwt.secret=${JWT_SECRET:...}
jwt.expiration=${JWT_EXPIRATION:86400000}

# CORS
cors.allowed-origins=${CORS_ALLOWED_ORIGINS:...}
```

### Docker Compose
**File**: `/home/user/conote/docker-compose.yml`

Services:
- PostgreSQL (database)
- Redis (caching)
- Elasticsearch (search)
- Spring Boot backend
- React frontend

---

## 12. IMPORTANT IMPLEMENTATION DETAILS

### Current Authorization Pattern
All document operations filter by current user:
```java
UUID userId = getCurrentUserId();  // From JWT token (email)
User user = userRepository.findByEmail(email);  // Convert email to UUID

// Document access: must match user_id
documentRepository.findByIdAndUserId(id, userId)
```

### Service Layer Approach
- Business logic in `DocumentService`
- Caching at service layer (via `@Cacheable`, `@CacheEvict`)
- Transactions managed via `@Transactional`

### Exception Handling
- Custom exceptions: `ResourceNotFoundException`, `BadRequestException`, `UnauthorizedAccessException`
- Global exception handler: `GlobalExceptionHandler.java`
- Returns structured error responses with HTTP status codes

---

## WHAT NEEDS TO BE ADDED FOR PRIVILEGE SYSTEM

### New Database Components
1. `document_permissions` table
2. `permission_shares` table (for tracking shares)
3. New audit event types for permission operations

### New Models
1. `DocumentPermission` entity
2. `PermissionLevel` enum (VIEW, EDIT, ADMIN)

### New Services
1. `PermissionService` - core privilege logic
2. `DocumentAccessValidator` - authorization checks
3. Update `DocumentService` to respect permissions
4. Update `AuditLogService` to log permission changes

### New DTOs
1. `ShareDocumentRequest`
2. `PermissionResponse`
3. `SharedDocumentInfo`

### Frontend Updates
1. Share dialog component
2. Permission manager UI
3. Display shared documents differently in tree
4. Permission management interface

### New API Endpoints
1. `POST /api/documents/{id}/share` - Share document
2. `DELETE /api/documents/{id}/share/{userId}` - Revoke access
3. `PATCH /api/documents/{id}/permissions/{userId}` - Change permission level
4. `GET /api/documents/{id}/permissions` - List who has access
5. `GET /api/documents/shared-with-me` - Get documents shared with current user

---

## Summary Table

| Aspect | Status | Location | Notes |
|--------|--------|----------|-------|
| **User Management** | ✅ Complete | `/model/User.java` | RBAC exists but unused |
| **Authentication** | ✅ Complete | `/service/AuthService.java` | JWT + account lockout |
| **Document CRUD** | ✅ Complete | `/service/DocumentService.java` | Single-owner only |
| **Tree Structure** | ✅ Complete | `DocumentService.buildTree()` | Parent-child hierarchy |
| **Search** | ✅ Complete | Elasticsearch | User-scoped search |
| **Caching** | ✅ Complete | Redis | Document tree cached |
| **Audit Logging** | ✅ Partial | `/model/AuditLog.java` | Lacks permission events |
| **Document Sharing** | ❌ Missing | - | Needs implementation |
| **Privilege System** | ❌ Missing | - | Needs implementation |
| **Permission Inheritance** | ❌ Missing | - | Needs design |

