# Loan App API

A secure and scalable loan application backend API built with NestJS, PostgreSQL, and Drizzle ORM.

## Description

This is the backend API for a loan application system, featuring secure authentication, CSRF
protection, and comprehensive user management. Built with modern technologies and best practices for
production-ready applications.

## Features

- 🔐 **Secure Authentication** - JWT-based authentication with session management
- 🛡️ **CSRF Protection** - Built-in CSRF token validation
- 🔑 **OAuth Integration** - Google OAuth 2.0 authentication support
- 📊 **Database ORM** - Drizzle ORM for type-safe database queries
- 🐘 **PostgreSQL** - Robust relational database with Docker support
- 🔒 **Password Encryption** - Bcrypt password hashing
- 🌐 **API Response Standardization** - Consistent response format across all endpoints
- 📝 **Request Logging** - Comprehensive request/response logging
- 🎯 **Device Tracking** - User agent and device information tracking

## Tech Stack

- **Framework:** NestJS
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Authentication:** Passport.js (JWT & Google OAuth)
- **Security:** CSRF-CSRF, bcryptjs
- **Package Manager:** pnpm

## Prerequisites

- Node.js (v18 or higher)
- pnpm
- Docker (for PostgreSQL)

## Project Setup

1. **Install dependencies:**

```bash
pnpm install
```

2. **Configure environment variables:** Create a `.env` file in the root directory with the
   following variables:

```env
# Application
NODE_ENV=development
PORT=8080

# Database
DATABASE_URL="postgresql://auth_project:auth_project@localhost:5666/auth_project?schema=public"

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback

# Postgres Docker Configuration
POSTGRES_USER=auth_project
POSTGRES_PASSWORD=auth_project
POSTGRES_DB=auth_project
```

3. **Start PostgreSQL with Docker:**

```bash
docker-compose up -d
```

4. **Generate and run database migrations:**

```bash
# Generate migration files
pnpm db:generate

# Push schema changes to database
pnpm db:push
```

## Running the Application

```bash
# Development mode with watch
pnpm dev

# Standard development mode
pnpm start

# Production mode
pnpm prod
```

The API will be available at `http://localhost:8080` (or your configured PORT).

## Database Management

```bash
# Open Drizzle Studio (database GUI)
pnpm db:studio

# Generate new migrations
pnpm db:generate

# Run migrations
pnpm db:migrate

# Push schema changes directly
pnpm db:push

# Clear database
pnpm db:clear
```

## Code Quality

```bash
# Format code
pnpm format

# Lint code
pnpm lint

# Build for production
pnpm build
```

## Project Structure

```
src/
├── app/
│   └── auth/                 # Authentication module
│       ├── strategies/       # Passport strategies (JWT, Google)
│       ├── auth.service.ts   # Authentication logic
│       ├── auth.controller.ts
│       └── auth.guard.ts
├── core/                     # Core utilities
│   ├── crypto/              # Encryption services
│   ├── validators/          # Schema validators
│   └── constants.ts
├── csrf/                    # CSRF protection module
├── database/                # Database configuration
│   ├── schema.ts           # Database schema
│   └── connection.ts
└── models/
    └── drizzle/            # Drizzle ORM models
```

## API Endpoints

### Authentication

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with credentials
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `POST /auth/logout` - Logout user
- `GET /auth/profile` - Get user profile

### CSRF

- `GET /csrf` - Get CSRF token

## Security Features

- JWT token-based authentication
- HTTP-only cookies for token storage
- CSRF token validation on state-changing requests
- Password hashing with bcrypt
- Session management with device tracking
- IP address and user agent logging

## Documentation

For additional documentation, see:

- [CSRF Implementation](docs/CSRF_IMPLEMENTATION.md)
- [Testing Removal Guide](docs/REMOVE_TESTING.md)

## License

UNLICENSED - Private project
