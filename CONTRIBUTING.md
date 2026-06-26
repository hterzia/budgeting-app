# Contributing to Budgeting App

Thank you for your interest in contributing to the Budgeting App! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to ensure a welcoming and inclusive environment for everyone.

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please check the issue tracker to see if the bug has already been reported. If it has, add a comment to the existing issue instead of creating a new one.

**How to Report a Bug:**

1. Use the GitHub issue tracker
2. Provide a clear, descriptive title
3. Include steps to reproduce
4. Include expected behavior
5. Include actual behavior
6. Include environment details (OS, browser, versions)
7. Include screenshots if applicable

### Suggesting Features

Feature requests are welcome! Please provide:

1. Clear description of the feature
2. Use cases and scenarios
3. Any alternative solutions you've considered

### Pull Requests

1. Fork the repository
2. Create a branch for your feature or fix
3. Make your changes
4. Run tests and ensure they pass
5. Ensure code follows project style
6. Update documentation as needed
7. Open a pull request

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ with pgvector extension

### Setting Up Development Environment

1. **Clone the repository**

   ```bash
   git clone https://github.com/hterzia/budgeting-app.git
   cd budgeting-app
   ```

2. **Set up the database**

   ```bash
   cd backend
   cp .env.example .env.local
   # Edit .env.local with your PostgreSQL credentials
   npm run migration:up
   ```

3. **Install dependencies**

   ```bash
   # Root directory
   npm install

   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

4. **Run the development servers**

   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

## Coding Standards

### JavaScript/TypeScript

- Use TypeScript for all new code
- Follow the existing code style
- Use descriptive variable and function names
- Add JSDoc comments for exported functions and components
- Use 2-space indentation
- Use single quotes for strings
- Use semicolons
- Use ES2020 module syntax (`import`/`export`)

### Component Style

- Use functional components with hooks
- Use TypeScript interfaces for props
- Add meaningful prop names
- Export components with React.memo for performance

### Database

- Use parameterized queries (never concatenate SQL)
- Add indexes for frequently queried columns
- Write migration files with proper rollback
- Test migrations before committing

### Testing

- Write tests for all new functionality
- Ensure existing tests pass
- Aim for high test coverage
- Use descriptive test names

## Commit Messages

We follow the Conventional Commits specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(transactions): add category filtering
fix(import): handle missing currency field
docs(readme): update setup instructions
test(api): add tests for transaction list endpoint
```

## Pull Request Process

1. Update the README.md if adding features or changing setup
2. Update the documentation as needed
3. The PR will be reviewed by maintainers
4. Address any feedback
5. Once approved, the PR will be merged

## Questions?

Feel free to open an issue or ask in the discussions section!
