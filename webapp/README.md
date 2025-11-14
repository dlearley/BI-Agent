# BI-Agent Web Application

A modern Next.js web application for the BI-Agent analytics platform with authentication, RBAC, and comprehensive data visualization.

## Features

- **Authentication**: Login and onboarding flows
- **Role-Based Access Control (RBAC)**: Route protection based on user roles and permissions
- **Global Layout**: Sidebar navigation with dashboard, catalog, queries, dashboards, insights, alerts, reports, and admin sections
- **State Management**: Zustand for client-side state
- **Data Fetching**: TanStack Query (React Query) with generated SDK
- **UI Components**: shadcn/ui with Tailwind CSS
- **Testing**: Vitest for unit/component tests, Playwright for E2E tests

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3001`

### Building

Build the production bundle:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Testing

### Unit/Component Tests

Run Vitest tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run tests with UI:

```bash
npm run test:ui
```

### E2E Tests

Run Playwright tests:

```bash
npm run test:e2e
```

Run Playwright tests in headed mode:

```bash
npm run test:e2e:headed
```

Run Playwright tests with UI:

```bash
npm run test:e2e:ui
```

## Architecture

### Directory Structure

```
webapp/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── login/        # Login page
│   │   ├── onboarding/   # Onboarding page
│   │   ├── catalog/      # Data catalog page
│   │   ├── queries/      # Query builder page
│   │   ├── dashboards/   # Dashboards page
│   │   ├── insights/     # Insights page
│   │   ├── alerts/       # Alerts page
│   │   ├── reports/      # Reports page
│   │   └── admin/        # Admin panel page
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui components
│   │   ├── app-layout.tsx
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   ├── rbac-guard.tsx
│   │   └── global-search.tsx
│   ├── hooks/           # React hooks
│   ├── lib/             # Utilities and API client
│   ├── store/           # Zustand stores
│   ├── types/           # TypeScript types
│   └── test/            # Test utilities and setup
├── e2e/                 # Playwright E2E tests
└── public/              # Static assets
```

### Authentication Flow

1. User navigates to a protected route
2. `RBACGuard` checks authentication status
3. If not authenticated, redirects to `/login` with redirect parameter
4. User logs in with credentials
5. API returns JWT token and user data
6. Token stored in localStorage, user data in Zustand store
7. User redirected to originally intended route

### RBAC Implementation

The `RBACGuard` component enforces role-based access control:

- **Roles**: Admin, Recruiter, Viewer
- **Permissions**: VIEW_ANALYTICS, MANAGE_ANALYTICS, VIEW_PII, EXPORT_DATA, etc.
- Routes can require specific roles and/or permissions
- Admin panel requires `ADMIN` role and `MANAGE_GOVERNANCE` permission

### API Integration

The webapp communicates with the analytics service via:

- **API Client**: Axios-based client with automatic token injection
- **React Query Hooks**: Custom hooks for data fetching with caching
- **Type Safety**: Shared TypeScript types between frontend and backend

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_API_VERSION=v1
```

## Mock Authentication

For development, use these test credentials:

- **Admin**: admin@example.com / password123
- **Recruiter**: recruiter@example.com / password123
- **Viewer**: viewer@example.com / password123

## Technologies

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui, Radix UI
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **HTTP Client**: Axios
- **Form Handling**: React Hook Form with Zod validation
- **Testing**: Vitest, React Testing Library, Playwright
- **Icons**: Lucide React

## License

MIT
