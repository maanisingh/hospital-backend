# Railway Deployment Guide - Hospital SaaS Backend

## Prerequisites
- GitHub repository: https://github.com/maanisingh/hospital-backend
- Railway account: https://railway.app

## Step-by-Step Deployment

### 1. Create New Railway Project

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub account
5. Select repository: `maanisingh/hospital-backend`

### 2. Add PostgreSQL Database

1. In your Railway project dashboard
2. Click "+ New" button
3. Select "Database" → "Add PostgreSQL"
4. Wait for database to deploy (30-60 seconds)

### 3. Configure Environment Variables

In your backend service settings, add these environment variables:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**Important:** Replace `JWT_SECRET` with a secure random string for production.

### 4. Deploy Configuration

The repository includes `railway.json` which automatically:
- Installs dependencies
- Generates Prisma client
- Runs database migrations
- Starts the server

### 5. Generate Public Domain

1. Go to your backend service settings
2. Click on "Networking" tab
3. Click "Generate Domain"
4. Your API will be available at: `https://your-project.up.railway.app`

### 6. Verify Deployment

Test your API endpoints:

```bash
# Health check
curl https://your-project.up.railway.app/api/health

# Login test
curl -X POST https://your-project.up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@hospital.com","password":"admin123"}'
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-secret-key-here` |

## Automatic Features

### ✅ Auto-Deploy on Git Push
Every push to `main` branch automatically triggers a new deployment.

### ✅ Auto-Migrations
Prisma migrations run automatically on each deployment via the `railway.json` start command.

### ✅ Auto-Scaling
Railway automatically scales your application based on traffic.

## Troubleshooting

### 502 Bad Gateway
- Check if the service is running in Railway dashboard
- Verify environment variables are set correctly
- Check deployment logs for errors

### Database Connection Failed
- Ensure `DATABASE_URL` is set to `${{Postgres.DATABASE_URL}}`
- Verify PostgreSQL service is running
- Check if migrations completed successfully

### Build Failed
- Check build logs in Railway dashboard
- Verify `package.json` has all required dependencies
- Ensure Node.js version compatibility

## Monitoring

### View Logs
```bash
# In Railway dashboard
Click on service → Deployments → View Logs
```

### Check Metrics
- CPU usage
- Memory usage
- Request count
- Response times

All available in Railway dashboard under "Metrics" tab.

## Current Deployment Status

**Repository:** https://github.com/maanisingh/hospital-backend
**Status:** ✅ Code pushed to GitHub, ready for Railway deployment
**Next Step:** Follow steps 1-6 above to deploy

## Support Resources

- [Railway Docs](https://docs.railway.com)
- [Deploy Express App Guide](https://docs.railway.com/guides/express)
- [Environment Variables](https://docs.railway.com/develop/variables)
- [Custom Domains](https://docs.railway.com/deploy/exposing-your-app)
