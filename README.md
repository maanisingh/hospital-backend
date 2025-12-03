# Hospital SaaS Backend

Complete hospital management system backend with role-based access control (RBAC).

## 🚀 Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/maanisingh/hospital-backend)

### Manual Deployment Steps

1. Go to [Railway](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `maanisingh/hospital-backend`
5. Add PostgreSQL database
6. Configure environment variables (see below)
7. Deploy!

## 📋 Environment Variables

Copy these to Railway Dashboard:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
PORT=3000
JWT_SECRET=your-secure-jwt-secret-here
FRONTEND_URL=https://your-frontend-domain.com
```

## 🔐 RBAC Implementation

This backend includes comprehensive role-based access control with:

- **9 User Roles**: Super Admin, Admin, Doctor, Nurse, Receptionist, Pharmacist, Lab Technician, Accountant, Patient
- **52 Protected Endpoints** across all modules
- **Granular Permissions** for each role

### Default Test Users

After first deployment, these users are auto-created:

| Email | Password | Role |
|-------|----------|------|
| superadmin@hospital.com | password123 | Super Admin |
| admin@hospital.com | password123 | Admin |
| doctor@hospital.com | password123 | Doctor |
| nurse@hospital.com | password123 | Nurse |
| receptionist@hospital.com | password123 | Receptionist |
| pharmacist@hospital.com | password123 | Pharmacist |
| labtech@hospital.com | password123 | Lab Technician |
| accountant@hospital.com | password123 | Accountant |
| patient@hospital.com | password123 | Patient |

**⚠️ Change these passwords in production!**

## 🏗️ Architecture

### Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT
- **Deployment**: Railway

### Project Structure
```
├── server.js                   # Entry point
├── middleware/
│   ├── auth.js                # JWT authentication
│   └── rbac.js                # Role-based access control
├── routes/
│   ├── users.js               # User management
│   ├── patients.js            # Patient records
│   ├── appointments.js        # Appointments
│   ├── billingInvoices.js    # Billing & invoices
│   ├── pharmacy.js            # Pharmacy management
│   ├── laboratory.js          # Lab tests
│   ├── wards.js               # Ward management
│   ├── staff.js               # Staff management
│   ├── reports.js             # Reports & analytics
│   └── dashboard.js           # Dashboard statistics
├── prisma/
│   └── schema.prisma          # Database schema
└── railway.json               # Railway deployment config
```

## 📚 Documentation

- [Railway Deployment Guide](./RAILWAY_DEPLOYMENT_GUIDE.md)
- [RBAC Implementation](./RBAC_IMPLEMENTATION_COMPLETE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Client Requirements](./CLIENT_REQUIREMENTS_CHECKLIST.md)

## 🧪 Testing

### Health Check
```bash
curl https://your-api-url.railway.app/api/health
```

### Login Test
```bash
curl -X POST https://your-api-url.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@hospital.com","password":"password123"}'
```

### Get Patients (with token)
```bash
curl https://your-api-url.railway.app/api/patients?orgId=your-org-id \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔧 Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Setup
```bash
# Clone repository
git clone https://github.com/maanisingh/hospital-backend.git
cd hospital-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Start development server
npm run dev
```

Server will run on `http://localhost:5000`

## 🛠️ Available Scripts

```bash
npm start              # Start production server
npm run dev           # Start development server with nodemon
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:push      # Push schema changes to database
```

## 📊 Database Schema

The system includes comprehensive models for:

- Users & Organizations
- Patients & Medical Records
- Appointments & Scheduling
- Billing & Invoices
- Pharmacy & Medications
- Laboratory Tests
- Wards & Beds
- Staff Management
- Reports & Analytics

See [Prisma Schema](./prisma/schema.prisma) for details.

## 🔒 Security Features

- ✅ JWT-based authentication
- ✅ Role-based access control (RBAC)
- ✅ Password hashing with bcrypt
- ✅ SQL injection protection (Prisma)
- ✅ CORS configuration
- ✅ Environment variable protection
- ✅ Input validation

## 🚦 API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user

### Patients
- `GET /api/patients` - List all patients
- `POST /api/patients` - Create patient
- `GET /api/patients/:id` - Get patient details
- `PUT /api/patients/:id` - Update patient
- `DELETE /api/patients/:id` - Delete patient

### Appointments
- `GET /api/appointments` - List appointments
- `POST /api/appointments` - Create appointment
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Cancel appointment

...and 40+ more endpoints across all modules.

See [API Documentation](./API_DOCUMENTATION.md) for complete list.

## 📈 Monitoring

Railway provides built-in monitoring:
- Request logs
- Error tracking
- CPU/Memory usage
- Response times
- Database performance

Access via Railway Dashboard → Metrics tab

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- **Documentation**: See `/docs` folder
- **Issues**: [GitHub Issues](https://github.com/maanisingh/hospital-backend/issues)
- **Railway Docs**: [docs.railway.com](https://docs.railway.com)

## 🎯 Roadmap

- [x] Complete RBAC implementation
- [x] All 52 endpoints protected
- [x] Auto-seeding test users
- [x] Railway deployment config
- [ ] API rate limiting
- [ ] Email notifications
- [ ] File upload support
- [ ] Advanced reporting
- [ ] Real-time notifications (WebSocket)

## 📝 Version History

- **v1.0.0** (Dec 2025) - Initial release with complete RBAC
  - 9 user roles implemented
  - 52 endpoints with access control
  - Production-ready deployment

---

**Built with ❤️ for Healthcare Management**

**Repository**: https://github.com/maanisingh/hospital-backend
**Deployment**: Railway (https://railway.app)
