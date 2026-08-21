# AGENTS.md

## Project Overview

This repository contains a **Full Stack Mini Marketplace Application**.

The application allows users to browse products, create accounts, authenticate, manage their own products, and interact with the marketplace through a responsive frontend connected to a secure backend API.

When implementing features, prioritize:

1. Correct functionality
2. Backend security
3. Authorization and ownership validation
4. Clean architecture
5. Proper error handling
6. Responsive UI
7. Maintainable and readable code

Do not sacrifice backend correctness or security for visual appearance.

---

# Mandatory Technology Stack

## Frontend

Use only:

- HTML5
- CSS3
- Vanilla JavaScript
- Fetch API

### Frontend Restrictions

Do NOT use:

- React
- Next.js
- Vue
- Angular
- Svelte
- Any frontend framework

Do not introduce unnecessary frontend dependencies.

Keep the frontend implementation based on modular Vanilla JavaScript where appropriate.

---

## Backend

Use:

- Node.js
- Express.js
- MongoDB
- Mongoose

Use modern JavaScript and ES Modules unless the existing project architecture explicitly uses CommonJS.

Do not mix CommonJS and ES Modules unnecessarily.

---

## Required Packages and Services

The project may use the following core technologies:

- `jsonwebtoken` for JWT authentication
- `bcrypt` or `bcryptjs` for password hashing
- `nodemailer` for email-based functionality
- `cloudinary` for image storage and management
- `multer` or another appropriate middleware for handling image uploads when required
- `dotenv` for environment variables
- `cors` when frontend and backend run on different origins

Do not add unnecessary packages when native JavaScript or existing project utilities can solve the problem.

---

# Project Architecture

Maintain a clear separation between frontend and backend.

Recommended high-level structure:

```text
project-root/
│
├── frontend/
│   ├── css/
│   ├── js/
│   ├── images/
│   ├── index.html
│   └── ...
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   ├── app.js
│   └── server.js
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── AGENTS.md
```

The exact structure may evolve, but responsibilities must remain clearly separated.

---

# Backend Architecture Rules

## Models

Mongoose models are responsible for:

- Schema definitions
- Data structure
- Database-level validation where appropriate
- References between collections

Do not place complex route logic inside models unless the project architecture specifically requires it.

---

## Controllers

Controllers should handle:

- Request processing
- Validation
- Calling database operations
- Preparing API responses
- Coordinating application logic

Controllers should not become unnecessarily large.

Break repeated or reusable logic into utilities or services when appropriate.

---

## Routes

Routes should primarily define:

- HTTP method
- Endpoint path
- Middleware
- Controller

Avoid placing large business logic directly inside route files.

---

## Middleware

Use middleware for cross-cutting concerns such as:

- Authentication
- Authorization
- Request validation where reusable
- Error handling
- File upload processing

Protected routes must use backend authentication middleware.

---

## Utilities

Reusable helpers should be placed in appropriate utility modules.

Examples may include:

- JWT helpers
- Email helpers
- OTP helpers
- Cloudinary helpers
- Validation helpers

Do not duplicate the same utility logic across multiple files.

---

# API Development Rules

Follow REST-style conventions where practical.

Use appropriate HTTP methods:

```text
GET     → Read resources
POST    → Create resources
PUT     → Update complete resources
PATCH   → Update partial resources when appropriate
DELETE  → Delete resources
```

Use meaningful endpoint naming.

Example pattern:

```text
/api/auth/...
/api/products/...
/api/users/...
```

Do not expose unnecessary internal implementation details through API responses.

---

# HTTP Response Rules

Use appropriate HTTP status codes.

Common examples:

```text
200 → Successful request
201 → Resource created successfully
400 → Invalid request or validation error
401 → Authentication required or invalid authentication
403 → Authenticated but not authorized
404 → Resource not found
409 → Conflict, such as duplicate data
500 → Internal server error
```

Every API should return predictable JSON responses.

Prefer a consistent response structure such as:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

For errors:

```json
{
  "success": false,
  "message": "Human-readable error message"
}
```

Do not expose passwords, password hashes, JWT secrets, OTP secrets, database credentials, or other sensitive information in responses.

---

# Database Rules

Use MongoDB through Mongoose.

When creating schemas:

- Define required fields properly.
- Use correct data types.
- Use references where relationships exist.
- Enable timestamps where useful.
- Validate enum-like fields at the schema level where appropriate.
- Prevent invalid data from silently entering the database.

Always handle invalid MongoDB ObjectIds safely.

A malformed ID must not crash the application.

---

# Authentication and Security Rules

Security is a mandatory priority.

## Password Security

Never:

- Store passwords in plain text.
- Return password hashes in API responses.
- Log passwords.
- Include passwords in URLs.

Passwords must be hashed using `bcrypt` or `bcryptjs`.

---

## JWT Security

JWT handling must follow these rules:

- JWT secrets must come from environment variables.
- Protected APIs must verify the token on the backend.
- Authentication state should not rely only on frontend checks.
- Invalid or expired tokens must be rejected.
- The authenticated user should be made available to downstream middleware/controllers in a safe and consistent way.

Never hard-code JWT secrets.

---

## Authorization and Ownership

Authentication and authorization are different.

A logged-in user must not automatically be allowed to modify every resource.

For any resource owned by a user:

1. Authenticate the request.
2. Identify the authenticated user from the JWT.
3. Retrieve the target resource.
4. Verify ownership on the backend.
5. Reject the request if ownership does not match.

Frontend restrictions are only for user experience.

They are NOT a security mechanism.

Never rely only on:

- Hidden buttons
- Disabled buttons
- Frontend checks
- URL restrictions

The backend must enforce authorization.

---

# Environment Variables

Sensitive configuration must be stored in `.env`.

Examples may include:

```text
PORT=
MONGODB_URI=
JWT_SECRET=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=
```

The exact variable names may change based on implementation, but:

- `.env` must never be committed to Git.
- Secrets must never be hard-coded.
- `.env.example` should document required variables without real secrets.

---

# Frontend Development Rules

Use:

- Semantic HTML where appropriate.
- Modular JavaScript where useful.
- Organized CSS.
- Responsive layouts.
- Reusable UI patterns without unnecessary duplication.

The frontend should communicate with the backend using the Fetch API.

Keep API communication logic organized rather than scattering repeated fetch code across every page.

---

## Frontend State Handling

For asynchronous operations, properly handle:

- Loading
- Success
- Error
- Empty states

Do not allow API failures to fail silently.

Users should receive understandable feedback.

Avoid vague messages such as:

```text
Error
Something went wrong
Failed
```

when a more useful message can safely be provided.

---

## Authentication on the Frontend

Frontend authentication checks are useful for:

- Navigation
- UI state
- Redirects
- Showing or hiding user-specific controls

However, frontend checks are never a replacement for backend security.

The backend remains the source of truth for protected resources and authorization.

---

# Image and External Storage Rules

When image storage is required:

- Use Cloudinary.
- Do not permanently store uploaded production images inside the project repository.
- Store the appropriate Cloudinary URL or metadata in MongoDB.
- Handle upload failures properly.
- Validate uploaded files where possible.

Do not expose Cloudinary API secrets to the frontend.

---

# Validation Rules

Validate data on both levels where appropriate:

## Frontend Validation

Use frontend validation for:

- Better user experience
- Immediate feedback
- Basic form validation

## Backend Validation

Backend validation is mandatory because frontend validation can be bypassed.

Never trust data received from the frontend without server-side validation.

---

# Error Handling

All important operations should have proper error handling.

Do not:

- Leave unhandled promise rejections.
- Let expected errors crash the server.
- Return raw internal error details to end users.
- Swallow errors silently.

Log useful information for development without logging secrets or sensitive user information.

Use centralized error handling if the project architecture supports it.

---

# Code Quality Rules

Write code that is:

- Readable
- Maintainable
- Consistent
- Properly formatted
- Easy to debug

Use descriptive names.

Good:

```javascript
authenticatedUser
productId
updateProduct
sendOtpEmail
```

Avoid vague names such as:

```javascript
x
data1
temp
abc
func
```

unless the scope is extremely small and obvious.

Avoid unnecessary nesting.

Avoid duplicating logic.

Extract reusable logic into functions or modules.

---

# Comments

Do not add comments that merely repeat obvious code.

Bad:

```javascript
// Set name
user.name = name;
```

Add comments only when they explain:

- A non-obvious decision
- Security reasoning
- Complex logic
- Important implementation constraints

---

# Dependency Rules

Before adding a new dependency:

1. Check whether the project already contains a suitable dependency.
2. Check whether the functionality can be implemented cleanly with existing dependencies.
3. Avoid adding packages for trivial functionality.
4. Keep the dependency tree minimal.

Do not replace the required stack with a framework or unrelated technology without explicit instruction.

---

# Change Management Rules

When implementing a requested feature:

1. First inspect the relevant existing files.
2. Understand the current architecture.
3. Reuse existing patterns where they are correct.
4. Modify only the files necessary for the feature.
5. Avoid unnecessary refactoring.
6. Preserve existing working functionality.
7. Ensure frontend and backend changes remain compatible.
8. Update environment configuration when required.
9. Test the main success and failure paths.

Do not rewrite large parts of the project unless explicitly requested or genuinely necessary.

---

# Testing Expectations

Before considering a feature complete, test relevant scenarios including:

- Successful flow
- Validation failure
- Authentication failure where applicable
- Authorization failure where applicable
- Missing resource
- Invalid IDs
- Network/API errors where relevant
- Frontend empty states

For ownership-based resources, explicitly test with different users.

A user must never gain access to another user's protected resource simply by manually changing an ID in a URL or API request.

---

# Git Rules

Never commit:

- `.env`
- API keys
- Passwords
- JWT secrets
- Cloudinary secrets
- Email credentials
- Other private credentials

Ensure `.gitignore` protects sensitive local files.

Keep commits focused when possible.

---

# README Expectations

The project should maintain a clear `README.md` containing:

- Project overview
- Main features
- Technology stack
- Installation instructions
- Environment variable setup
- How to run frontend and backend
- Any required configuration steps

Do not include real credentials in the README.

---

# AI Agent Behavior

When working in this repository:

- First inspect existing code before making assumptions.
- Follow the existing architecture unless it conflicts with security or explicit requirements.
- Do not invent APIs, environment variables, database fields, or dependencies without checking the project context.
- Do not implement features that were not requested.
- Ask for clarification when a requirement is genuinely ambiguous and the ambiguity affects the implementation.
- Prefer simple, maintainable solutions over unnecessarily complex abstractions.
- Do not silently replace existing technologies.
- Keep frontend and backend integration consistent.
- Treat backend validation and authorization as mandatory security boundaries.
- Never expose secrets or sensitive data.
- Preserve working functionality while adding new features.

## Implementation Priority

When making technical decisions, prioritize in this order:

1. Security
2. Correctness
3. Required functionality
4. Data integrity
5. Maintainability
6. User experience
7. Visual polish
8. Optional abstractions

---

# Final Rule

Build this project as a real-world full-stack application.

A visually attractive interface is not enough.

Every implemented feature must be:

- Functionally correct
- Secure on the backend
- Properly validated
- Properly integrated
- Error-resistant
- Maintainable

When the user provides feature-specific requirements, follow those requirements together with this `AGENTS.md`.