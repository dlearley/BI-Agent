# CI/CD Pipeline Setup

This document describes the comprehensive GitHub Actions CI/CD pipeline configured for the BI-Agent Analytics platform.

## Overview

The CI/CD pipeline includes:
- ✅ **Linting**: ESLint for code quality and TypeScript type checking
- ✅ **Testing**: Jest unit tests with PostgreSQL and Redis services
- ✅ **Building**: TypeScript compilation and artifact generation
- ✅ **Security Scanning**: npm audit for vulnerability detection
- ✅ **Docker**: Image building with layer caching
- ✅ **Docker Compose**: Smoke tests for full stack
- ✅ **Playwright**: E2E tests with headless browsers (xvfb)
- ✅ **Typed Client Check**: Verification of TypeScript declarations
- ✅ **Caching**: pnpm dependency and Docker layer caching

## Workflows

### Main CI Pipeline (`.github/workflows/ci.yml`)

Runs on:
- Push to `main`, `develop`, or `ci-github-actions-workflows-*` branches
- Pull requests to `main` or `develop`

**Jobs:**

1. **Lint**
   - ESLint code quality checks
   - TypeScript type checking (`tsc --noEmit`)
   - TypeScript compilation verification
   - Caches: pnpm dependencies

2. **Test**
   - Jest unit and integration tests
   - Services: PostgreSQL 15, Redis 7
   - Code coverage generation
   - Artifacts: Coverage reports (7-day retention)
   - Caches: pnpm dependencies

3. **Build**
   - TypeScript compilation
   - Build artifact generation
   - Artifacts: Compiled output (7-day retention)
   - Caches: pnpm dependencies

4. **Security**
   - npm audit (moderate level - warnings)
   - npm audit production (high level - strict)
   - Continues on error for non-production issues

5. **Docker**
   - Docker image build for analytics-service
   - Docker BuildKit with layer caching
   - Caches: GitHub Actions Docker cache

6. **Docker Compose Smoke Test**
   - Full stack deployment test
   - Service health checks (analytics-backend, PostgreSQL, Redis)
   - HTTP endpoint verification
   - Database connectivity tests
   - Automatic cleanup on completion

7. **Typed Client Check**
   - Verifies TypeScript declaration generation
   - Checks build artifacts existence
   - Validates type safety

8. **Playwright E2E Tests**
   - End-to-end testing with Playwright
   - Headless Chromium with xvfb
   - Services: PostgreSQL 15, Redis 7
   - Application server startup and health checks
   - Artifacts: Test reports and server logs (7-day retention)
   - Caches: pnpm dependencies

9. **All Checks**
   - Aggregate status check
   - Fails if any job fails
   - Required for PR merging

### Playwright Tests (`.github/workflows/playwright.yml`)

Dedicated workflow for E2E testing that can be run independently.

Same configuration as the Playwright job in the main CI pipeline.

## Environment Variables

### CI Environment
```env
NODE_ENV=test
DATABASE_URL=postgresql://postgres:test_password@localhost:5432/analytics_db_test
REDIS_URL=redis://localhost:6379
JWT_SECRET=test-jwt-secret-for-ci
HIPAA_MODE=true
HIPAA_MIN_THRESHOLD=5
ANALYTICS_CACHE_TTL=300
ANALYTICS_REFRESH_INTERVAL=3600000
PORT=3000
```

### Workflow Variables
- `NODE_VERSION`: '18'
- `PNPM_VERSION`: '8.10.0'

## Caching Strategy

### pnpm Dependencies
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '18'
    cache: 'pnpm'
```

Benefits:
- Faster dependency installation
- Reduced network usage
- Consistent dependency versions

### Docker Layers
```yaml
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

Benefits:
- Faster Docker builds
- Reduced build times
- Efficient layer reuse

## Local Testing

### Prerequisites
```bash
# Install dependencies
npm install

# Verify Node.js version
node --version  # Should be >= 18.0.0
```

### Running Tests Locally

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix --workspace=bi-agent-analytics

# Run unit tests
npm run test

# Run tests with coverage
npm run test:coverage --workspace=bi-agent-analytics

# Build application
npm run build
```

### E2E Tests Locally

```bash
# Start required services
cd analytics-service
docker-compose up -d postgres redis

# Build and start application
npm run build
npm run start &

# Wait for app to be ready
curl http://localhost:3000/health

# Run E2E tests
npm run test:e2e

# Stop services
docker-compose down
```

### Docker Compose Testing

```bash
cd analytics-service

# Start all services
docker-compose up -d

# Check service health
docker-compose ps
curl http://localhost:3000/health

# View logs
docker-compose logs -f analytics-backend

# Run smoke tests
curl http://localhost:3000/api/v1/analytics/health

# Stop and clean up
docker-compose down -v
```

## Security Scanning

### npm audit
The pipeline runs two npm audit checks:

1. **Development Dependencies** (moderate level)
   - Checks all dependencies
   - Warns on moderate vulnerabilities
   - Continues on error

2. **Production Dependencies** (high level)
   - Checks production dependencies only
   - Fails on high/critical vulnerabilities
   - Required for CI to pass

### Fixing Vulnerabilities
```bash
# Check for vulnerabilities
npm audit

# Attempt automatic fixes
npm audit fix

# Force fixes (may have breaking changes)
npm audit fix --force

# Review specific package
npm audit --package=<package-name>
```

## Artifacts

### Coverage Reports
- **Location**: `analytics-service/coverage/`
- **Format**: HTML, LCOV, text
- **Retention**: 7 days
- **Access**: GitHub Actions artifacts tab

### Build Artifacts
- **Location**: `analytics-service/dist/`
- **Content**: Compiled JavaScript and type definitions
- **Retention**: 7 days
- **Use**: Deployment, debugging

### Playwright Reports
- **Location**: `analytics-service/playwright-report/`
- **Format**: HTML report with screenshots/videos
- **Retention**: 7 days
- **Access**: GitHub Actions artifacts tab

### Server Logs
- **Location**: `server.log` (root)
- **Triggers**: On Playwright test failure
- **Retention**: 7 days
- **Use**: Debugging E2E test failures

## Troubleshooting

### Lint Failures

**Problem**: ESLint errors failing the build

**Solutions**:
1. Run `npm run lint` locally
2. Fix errors automatically: `npm run lint:fix --workspace=bi-agent-analytics`
3. Review `.eslintrc.json` configuration
4. Check TypeScript compilation errors

### Test Failures

**Problem**: Unit tests failing in CI

**Solutions**:
1. Check service health (PostgreSQL, Redis)
2. Verify environment variables
3. Review test logs in artifacts
4. Run tests locally with same services
5. Check database connection strings

### Docker Build Failures

**Problem**: Docker image build failing

**Solutions**:
1. Verify Dockerfile syntax
2. Check build context includes all files
3. Review Docker build logs in CI
4. Test build locally: `docker build -t test analytics-service/`
5. Check for missing dependencies

### Docker Compose Smoke Test Failures

**Problem**: Services not starting or health checks failing

**Solutions**:
1. Check docker-compose.yml configuration
2. Verify .env file setup
3. Review service logs: `docker-compose logs`
4. Check port conflicts
5. Verify health check endpoints
6. Increase timeout in workflow if needed

### Playwright Test Failures

**Problem**: E2E tests failing or timing out

**Solutions**:
1. Check application server startup logs
2. Verify health endpoint responds
3. Review Playwright report artifacts
4. Check server logs artifact
5. Increase wait timeout if needed
6. Run tests locally with `npm run test:e2e:headed`
7. Use Playwright UI: `npm run test:e2e:ui`

### Security Scan Failures

**Problem**: npm audit finding vulnerabilities

**Solutions**:
1. Review audit report: `npm audit`
2. Update dependencies: `npm update`
3. Fix vulnerabilities: `npm audit fix`
4. Check if vulnerabilities are in dev dependencies
5. Consider if vulnerabilities affect production
6. Update specific packages: `npm install <package>@latest`

## Best Practices

### Before Pushing Code
1. ✅ Run `npm run lint` and fix issues
2. ✅ Run `npm run test` to verify unit tests pass
3. ✅ Run `npm run build` to check compilation
4. ✅ Test locally with Docker Compose
5. ✅ Check for security vulnerabilities: `npm audit`

### During Development
1. ✅ Write tests for new features
2. ✅ Maintain code coverage
3. ✅ Follow TypeScript best practices
4. ✅ Use ESLint rules consistently
5. ✅ Add E2E tests for critical flows

### Code Review
1. ✅ Ensure all CI checks pass
2. ✅ Review test coverage changes
3. ✅ Check for security vulnerabilities
4. ✅ Verify Docker builds succeed
5. ✅ Review Playwright test results

### Branch Protection
Recommended GitHub branch protection rules:
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Require review from code owners
- Include status checks:
  - `lint`
  - `test`
  - `build`
  - `security`
  - `docker`
  - `docker-compose-smoke`
  - `typed-client-check`
  - `playwright`

## Performance Optimization

### Workflow Execution Times
Target times for each job:
- Lint: ~2 minutes
- Test: ~3 minutes
- Build: ~2 minutes
- Security: ~1 minute
- Docker: ~3 minutes
- Docker Compose: ~5 minutes
- Typed Client Check: ~2 minutes
- Playwright: ~5 minutes

**Total**: ~23 minutes (jobs run in parallel)

### Optimization Tips
1. Use caching effectively (pnpm, Docker)
2. Run jobs in parallel where possible
3. Minimize dependency installation time
4. Use specific Docker image tags
5. Optimize test execution (parallel tests)

## Future Enhancements

### Planned Improvements
- [ ] Add code coverage thresholds
- [ ] Implement parallel test execution
- [ ] Add performance testing
- [ ] Integrate Snyk/Dependabot
- [ ] Add deployment workflows
- [ ] Implement semantic versioning
- [ ] Add automated changelog generation
- [ ] Add visual regression testing
- [ ] Implement load testing
- [ ] Add database migration checks

### Python Components (Future)
The ticket mentioned Python tools (ruff, pytest, Bandit, alembic) which are not currently in this repository. When Python components are added:
- Add ruff linting workflow
- Add pytest testing workflow
- Add Bandit security scanning
- Add alembic migration checks
- Add pip caching strategy

## Support and Resources

### Documentation
- Main README: `/README.md`
- Workflow README: `/.github/workflows/README.md`
- This document: `/CI_CD_SETUP.md`

### Tools and Versions
- Node.js: 18.x
- pnpm: 8.10.0
- TypeScript: 5.2.2
- ESLint: 8.53.0
- Jest: 29.7.0
- Playwright: 1.40.0
- PostgreSQL: 15-alpine
- Redis: 7-alpine

### Useful Links
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [pnpm Documentation](https://pnpm.io/)
- [Playwright Documentation](https://playwright.dev/)
- [ESLint Documentation](https://eslint.org/)
- [Jest Documentation](https://jestjs.io/)

## Acceptance Criteria ✅

All acceptance criteria from the ticket have been met:

✅ **Linting**: ESLint configured for TypeScript code quality
✅ **Testing**: Jest tests with PostgreSQL/Redis services  
✅ **Building**: TypeScript compilation with artifact generation
✅ **Docker**: Image builds with layer caching
✅ **Docker Compose**: Smoke tests verify full stack deployment
✅ **Caching**: pnpm dependencies and Docker layers cached
✅ **Playwright**: E2E tests with xvfb headless browser support
✅ **Security**: npm audit integration for vulnerability scanning
✅ **Typed Client**: TypeScript declaration generation verification
✅ **Workflow Triggers**: Runs on push/PR to configured branches
✅ **Sample Config**: .env.ci provides sample configuration

Note: Python-specific tools (ruff, pytest, Bandit, alembic) are not included as this repository is Node.js/TypeScript-based. The workflow can be extended when Python components are added.
