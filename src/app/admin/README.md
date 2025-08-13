# GameHub Admin

This directory contains the admin interface for managing the GameHub reservation system.

## Features

- **Dashboard**: Overview of system health and metrics
- **Reservations**: Manage and view all reservations
- **Users**: Manage user accounts and permissions
- **Settings**: Configure system settings

## Development

### Prerequisites

- Node.js 18+
- MongoDB database
- Environment variables set up (see `.env.example`)

### Environment Variables

```env
# Admin
NEXT_PUBLIC_ADMIN_ENABLED=true

# Authentication
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/gamehub

# Monitoring
SENTRY_DSN=your-sentry-dsn

# Alerting (optional)
SENDGRID_API_KEY=your-sendgrid-key
SLACK_WEBHOOK_URL=your-slack-webhook
PAGERDUTY_API_KEY=your-pagerduty-key
```

### Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Access the admin dashboard at http://localhost:3000/admin/dashboard

## API Endpoints

### Admin API

- `GET /api/admin/metrics` - Get system metrics
- `GET /api/admin/users` - List all users (admin only)
- `PUT /api/admin/users/:id` - Update user (admin only)

### Public API

- `GET /api/health` - Health check
- `GET /api/ready` - Readiness check

## Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm test:watch
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Deployment

The admin interface is deployed as part of the main Next.js application.

### Vercel

1. Push your changes to the main branch
2. Vercel will automatically deploy the changes

### Self-Hosted

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## Security

- All admin routes are protected by authentication middleware
- Role-based access control (RBAC) is enforced
- Sensitive operations require confirmation
- All data is validated on both client and server

## Monitoring

The admin interface includes built-in monitoring:

- Error tracking with Sentry
- Performance monitoring
- Custom metrics and alerts

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

Proprietary - All rights reserved
