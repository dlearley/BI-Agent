# CI/CD Quick Start Guide

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Checks

#### Lint Code
```bash
npm run lint
```

Expected: 0 errors, ~43 warnings (all warnings are safe to ignore)

#### Build Application
```bash
npm run build
```

Expected: Build completes successfully, creates `analytics-service/dist/`

#### Run Unit Tests
```bash
# Start required services first
cd analytics-service
docker-compose up -d postgres redis

# Run tests
npm test

# Stop services
docker-compose down
```

### 3. Test Full Stack

#### Start Everything with Docker Compose
```bash
cd analytics-service
docker-compose up -d

# Wait for services to start
sleep 10

# Test health endpoint
curl http://localhost:3000/health

# View logs
docker-compose logs -f analytics-backend

# Stop everything
docker-compose down -v
```

### 4. Run E2E Tests

```bash
# Install Playwright browsers (first time only)
cd analytics-service
npx playwright install --with-deps chromium

# Start services
docker-compose up -d postgres redis

# Build and start application
cd ..
npm run build
cd analytics-service
npm start &

# Wait for app to be ready
sleep 5

# Run Playwright tests
npm run test:e2e

# Clean up
docker-compose down
```

## 🔧 Troubleshooting

### Issue: pnpm not found
**Solution**: The project uses npm locally, pnpm in CI. Use npm commands.

### Issue: Tests fail - "Cannot connect to database"
**Solution**: Start PostgreSQL and Redis:
```bash
cd analytics-service
docker-compose up -d postgres redis
```

### Issue: Port 3000 already in use
**Solution**: Kill existing process:
```bash
lsof -ti:3000 | xargs kill -9
```

### Issue: ESLint errors
**Solution**: Auto-fix issues:
```bash
npm run lint:fix --workspace=bi-agent-analytics
```

## 📋 Pre-Push Checklist

Before pushing your code:

- [ ] Run `npm run lint` - should pass with warnings only
- [ ] Run `npm run build` - should complete successfully  
- [ ] Run `npm test` - all tests should pass
- [ ] Test with Docker Compose - health check should succeed
- [ ] Review your changes with `git diff`
- [ ] Ensure no secrets in code

## 🎯 CI Pipeline Jobs

When you push, these jobs will run:

1. **Lint** (~2 min) - ESLint + TypeScript checking
2. **Test** (~3 min) - Jest tests with PostgreSQL/Redis
3. **Build** (~2 min) - TypeScript compilation
4. **Security** (~1 min) - npm audit
5. **Docker** (~3 min) - Docker image build
6. **Docker Compose** (~5 min) - Full stack smoke test
7. **Typed Client** (~2 min) - TypeScript declarations check
8. **Playwright** (~5 min) - E2E tests

**Total**: ~23 minutes (jobs run in parallel)

## 📊 Viewing CI Results

1. Go to your GitHub repository
2. Click "Actions" tab
3. Select your workflow run
4. View job details and logs
5. Download artifacts if needed

## 🎓 Learn More

- **Full Documentation**: See `CI_CD_SETUP.md`
- **Implementation Details**: See `.github/IMPLEMENTATION_SUMMARY.md`
- **Workflow Details**: See `.github/workflows/README.md`
- **Acceptance Criteria**: See `.github/CHECKLIST.md`

## 💡 Tips

### Speed Up Local Development

1. **Use Docker Compose for services**: Keeps your local machine clean
2. **Run lint before commit**: Catch issues early
3. **Use watch mode**: `npm run test:watch --workspace=bi-agent-analytics`
4. **Cache dependencies**: npm automatically caches, use `npm ci` for clean installs

### Best Practices

- ✅ Commit working code
- ✅ Write meaningful commit messages
- ✅ Test locally before pushing
- ✅ Review CI logs when builds fail
- ✅ Keep dependencies updated
- ✅ Add tests for new features

## 🔍 Common Commands

```bash
# Install dependencies
npm install

# Lint
npm run lint

# Lint with auto-fix
npm run lint:fix --workspace=bi-agent-analytics

# Build
npm run build

# Test
npm test

# Test with coverage
npm run test:coverage --workspace=bi-agent-analytics

# E2E tests
npm run test:e2e --workspace=bi-agent-analytics

# E2E tests with UI
npm run test:e2e:ui --workspace=bi-agent-analytics

# Start dev server
npm run dev

# Start production server
npm run start

# Docker commands
cd analytics-service
docker-compose up -d         # Start services
docker-compose ps            # Check status
docker-compose logs -f       # View logs
docker-compose down          # Stop services
docker-compose down -v       # Stop and remove volumes
```

## 📞 Support

Having issues? Check:

1. This quickstart guide
2. `CI_CD_SETUP.md` for detailed information
3. `.github/workflows/README.md` for workflow specifics
4. GitHub Actions logs for CI failures
5. Docker Compose logs for service issues

## ✅ Success!

If you can run these commands without errors, you're ready to go:

```bash
npm install
npm run lint
npm run build
```

Happy coding! 🎉
