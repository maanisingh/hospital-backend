# 🚀 DEPLOY NOW - Railway Deployment Instructions

## Repository Status: ✅ READY

**GitHub URL**: https://github.com/maanisingh/hospital-backend
**Branch**: main
**Commits**: 9 commits - All RBAC implementation complete
**Files**: Railway configured, documented, and ready to deploy

---

## 🎯 FASTEST DEPLOYMENT METHOD (5 Minutes)

### Step 1: Go to Railway
Open your browser and go to: **https://railway.app/new**

### Step 2: Connect GitHub
1. Click **"Deploy from GitHub repo"**
2. Click **"Login with GitHub"** if not already logged in
3. Click **"Authorize Railway"** to give Railway access to your GitHub repos

### Step 3: Select Repository
1. In the repository list, find and select: **`maanisingh/hospital-backend`**
2. Click **"Deploy Now"**
3. Railway will immediately start detecting and building your app (this is automatic!)

### Step 4: Add PostgreSQL Database
1. In your new Railway project, click the **"+ New"** button
2. Select **"Database"**
3. Click **"Add PostgreSQL"**
4. Wait 30-60 seconds for the database to provision
5. You'll see a new PostgreSQL service appear in your project

### Step 5: Configure Environment Variables
1. Click on your **backend service** (the one from GitHub, not the database)
2. Go to the **"Variables"** tab
3. Click **"+ New Variable"** and add these one by one:

```
DATABASE_URL = ${{Postgres.DATABASE_URL}}
NODE_ENV = production
PORT = 3000
JWT_SECRET = hospital-saas-jwt-production-secret-key-2025-secure
FRONTEND_URL = https://hospital-saas.alexandratechlab.com
CORS_ORIGIN = https://hospital-saas.alexandratechlab.com
```

**Important**: For `DATABASE_URL`, type exactly `${{Postgres.DATABASE_URL}}` - Railway will automatically replace this with your actual database URL.

### Step 6: Generate Public Domain
1. Still in your backend service settings, go to the **"Settings"** tab
2. Find the **"Networking"** section
3. Click **"Generate Domain"**
4. Railway will give you a URL like: `https://hospital-backend-production-xxxx.up.railway.app`
5. **Save this URL!** This is your API endpoint.

### Step 7: Trigger Deployment
1. If the deployment hasn't started automatically, click **"Deploy"**
2. Watch the **"Deployments"** tab for build progress
3. The build will take 2-3 minutes

### Step 8: Verify Deployment ✅
Once the build completes (you'll see ✅ Success), test your API:

```bash
# Replace with your actual Railway URL
curl https://hospital-backend-production-xxxx.up.railway.app/api/health

# Should return: {"status":"ok"}
```

---

## 🧪 POST-DEPLOYMENT TESTING

### Test 1: Health Check
```bash
curl https://your-railway-url.up.railway.app/api/health
```

**Expected Response:**
```json
{"status":"ok","timestamp":"2025-12-03T..."}
```

### Test 2: Login with Default Super Admin
```bash
curl -X POST https://your-railway-url.up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@hospital.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "superadmin@hospital.com",
      "role": "SUPER_ADMIN"
    },
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Test 3: Get Current User
```bash
# Use the access_token from previous response
curl https://your-railway-url.up.railway.app/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "email": "superadmin@hospital.com",
    "role": "SUPER_ADMIN",
    "permissions": ["ALL"]
  }
}
```

---

## 🔐 DEFAULT TEST USERS

After first deployment, these users are automatically created:

| Email | Password | Role | Access Level |
|-------|----------|------|--------------|
| superadmin@hospital.com | password123 | SUPER_ADMIN | Full access |
| admin@hospital.com | password123 | ADMIN | Admin access |
| doctor@hospital.com | password123 | DOCTOR | Medical access |
| nurse@hospital.com | password123 | NURSE | Nursing access |
| receptionist@hospital.com | password123 | RECEPTIONIST | Front desk |
| pharmacist@hospital.com | password123 | PHARMACIST | Pharmacy access |
| labtech@hospital.com | password123 | LAB_TECHNICIAN | Lab access |
| accountant@hospital.com | password123 | ACCOUNTANT | Financial access |
| patient@hospital.com | password123 | PATIENT | Patient portal |

**⚠️ IMPORTANT**: Change all these passwords immediately in production!

---

## 📋 DEPLOYMENT CHECKLIST

Use this checklist to track your deployment:

- [ ] Opened https://railway.app/new
- [ ] Logged in with GitHub
- [ ] Authorized Railway to access GitHub
- [ ] Selected `maanisingh/hospital-backend` repository
- [ ] Clicked "Deploy Now"
- [ ] Added PostgreSQL database to project
- [ ] Configured all 6 environment variables
- [ ] Generated public domain
- [ ] Waited for build to complete (2-3 min)
- [ ] Tested health check endpoint
- [ ] Tested login with superadmin
- [ ] Verified JWT token works
- [ ] Saved Railway URL for frontend configuration

---

## 🎨 CONNECT TO FRONTEND

Once your backend is deployed, update your frontend environment:

### Frontend Environment Variables

Edit your frontend `.env` file:

```env
NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app
NEXT_PUBLIC_API_BASE_URL=https://your-railway-url.up.railway.app/api
```

Or if using Railway for frontend too:

```env
NEXT_PUBLIC_API_URL=${{hospital-backend.RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_API_BASE_URL=${{hospital-backend.RAILWAY_PUBLIC_DOMAIN}}/api
```

---

## 🔧 RAILWAY AUTOMATIC FEATURES

Railway automatically handles:

✅ **Auto-Deploy on Git Push** - Every push to `main` triggers deployment
✅ **Auto-Migrations** - Prisma migrations run automatically
✅ **Auto-Scaling** - Scales based on traffic
✅ **Auto-SSL** - HTTPS enabled by default
✅ **Auto-Backups** - Database backed up regularly
✅ **Auto-Monitoring** - Logs and metrics available

---

## 📊 MONITORING YOUR DEPLOYMENT

### View Logs
1. Go to your Railway project
2. Click on your backend service
3. Go to **"Deployments"** tab
4. Click on the active deployment
5. View real-time logs

### Check Metrics
1. Go to **"Metrics"** tab in your service
2. Monitor:
   - CPU usage
   - Memory usage
   - Request count
   - Response times
   - Error rates

### Set Up Alerts
1. Go to project **"Settings"**
2. Configure **"Notifications"**
3. Add webhook or email for deployment failures

---

## 🚨 TROUBLESHOOTING

### Build Failed
**Check logs for errors:**
1. Go to Deployments tab
2. Click on failed deployment
3. Review build logs
4. Common issues:
   - Missing dependencies in package.json
   - Node version incompatibility
   - Environment variables not set

**Solution:**
- Fix the issue in your code
- Commit and push to GitHub
- Railway will auto-deploy again

### 502 Bad Gateway
**Possible causes:**
1. Service crashed during startup
2. Port misconfiguration
3. Database connection failed

**Solution:**
1. Check deployment logs for errors
2. Verify `DATABASE_URL` is set to `${{Postgres.DATABASE_URL}}`
3. Verify `PORT=3000` is set
4. Restart the service

### Database Connection Error
**Check:**
1. PostgreSQL service is running (green checkmark)
2. `DATABASE_URL` variable is correctly set
3. Backend service can reach database

**Solution:**
1. Go to PostgreSQL service
2. Check if it's running
3. Restart if needed
4. Redeploy backend service

### Migrations Failed
**Check logs for Prisma errors:**
```
npx prisma migrate deploy
```

**Solution:**
1. SSH into Railway (if needed)
2. Run migrations manually: `railway run npx prisma migrate deploy`
3. Or push new migration in code

---

## 💰 RAILWAY PRICING

### Hobby Plan (Free Tier)
- $5 free credit per month
- Perfect for development/testing
- Includes:
  - 500 hours execution time
  - 1GB storage
  - 100GB transfer

### Pro Plan (If Needed)
- $20/month base
- Pay-as-you-go for resources
- Includes:
  - Unlimited execution time
  - Custom domains
  - Priority support
  - Team collaboration

**Estimated cost for this app:**
- Development: $0-5/month (free tier)
- Production (low traffic): $10-20/month
- Production (high traffic): $30-50/month

---

## 📞 SUPPORT RESOURCES

### Railway
- **Dashboard**: https://railway.app/dashboard
- **Docs**: https://docs.railway.com
- **Discord**: https://discord.gg/railway
- **Status**: https://status.railway.app

### This Project
- **GitHub**: https://github.com/maanisingh/hospital-backend
- **Issues**: https://github.com/maanisingh/hospital-backend/issues
- **Docs**: See README.md and other .md files

---

## ✅ DEPLOYMENT COMPLETE CHECKLIST

Once you see all these ✅, your deployment is successful:

- [ ] ✅ Backend service shows "Active" status
- [ ] ✅ PostgreSQL service shows "Active" status
- [ ] ✅ Build completed with no errors
- [ ] ✅ Deployment logs show "Server is running"
- [ ] ✅ Health check returns 200 OK
- [ ] ✅ Login endpoint works
- [ ] ✅ JWT authentication works
- [ ] ✅ Can fetch data from API
- [ ] ✅ RBAC is enforced (test different roles)
- [ ] ✅ Frontend can connect to backend

---

## 🎉 NEXT STEPS AFTER DEPLOYMENT

1. **Update Frontend** - Configure frontend to use your Railway URL
2. **Test All Roles** - Login with different user roles and verify RBAC
3. **Change Passwords** - Update all default user passwords
4. **Set Up Monitoring** - Configure alerts in Railway
5. **Custom Domain** (Optional) - Add your own domain in Railway settings
6. **API Documentation** - Share your API URL with frontend team
7. **Performance Testing** - Test with realistic load
8. **Backup Strategy** - Configure Railway backup settings

---

## 📝 IMPORTANT URLS TO SAVE

After deployment, save these URLs:

```
Backend API: https://hospital-backend-production-xxxx.up.railway.app
Railway Dashboard: https://railway.app/dashboard
GitHub Repo: https://github.com/maanisingh/hospital-backend
Frontend: https://hospital-saas.alexandratechlab.com
```

---

## 🚀 YOU'RE READY!

Everything is prepared and waiting for you:

1. ✅ Code is on GitHub
2. ✅ Railway configuration is ready
3. ✅ RBAC is fully implemented
4. ✅ Documentation is complete
5. ✅ Test users will auto-create

**Just follow Step 1-8 above and you'll be deployed in 5 minutes!**

---

*Last Updated: December 3, 2025*
*Repository: https://github.com/maanisingh/hospital-backend*
*Deployment Platform: Railway (https://railway.app)*
