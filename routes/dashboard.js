// Role-Based Dashboard Routes
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import RBAC middleware
const { requirePermission, requireAdmin, requireSuperAdmin, requireRoleWithOrgScope } = require('../middleware/rbac');

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      errors: [{ message: 'Access token required' }]
    });
  }

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'hospital-saas-jwt-secret-2024';

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        errors: [{ message: 'Invalid or expired token' }]
      });
    }
    req.user = user;
    next();
  });
};

// ============================================================================
// SUPER ADMIN DASHBOARD
// ============================================================================
router.get('/superadmin', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const [
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      totalPlans,
      activePlans,
      totalPromotions,
      activePromotions,
      totalPayments
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: 'active' } }),
      prisma.user.count(),
      prisma.subscriptionPlan.count(),
      prisma.subscriptionPlan.count({ where: { status: 'active' } }),
      prisma.promotion.count(),
      prisma.promotion.count({ where: { isActive: true } }),
      prisma.paymentHistory.count()
    ]);

    const totalRevenue = await prisma.paymentHistory.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true }
    });

    // Recent organizations
    const recentOrgs = await prisma.organization.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        createdAt: true
      }
    });

    res.json({
      data: {
        organizations: {
          total: totalOrganizations,
          active: activeOrganizations,
          inactive: totalOrganizations - activeOrganizations,
          recent: recentOrgs
        },
        users: { total: totalUsers },
        subscriptionPlans: { total: totalPlans, active: activePlans },
        promotions: { total: totalPromotions, active: activePromotions },
        payments: { total: totalPayments },
        revenue: { total: totalRevenue._sum.amount || 0 }
      }
    });
  } catch (error) {
    console.error('Error fetching SuperAdmin dashboard:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// ============================================================================
// HOSPITAL ADMIN DASHBOARD
// ============================================================================
router.get('/hospital-admin', authenticateToken, requireRoleWithOrgScope(['HospitalAdmin', 'Doctor', 'Nurse']), async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    const [
      totalPatients,
      todayPatients,
      totalAppointments,
      todayAppointments,
      totalStaff,
      activeStaff,
      totalDepartments,
      totalBeds,
      occupiedBeds,
      pendingPayments,
      todayRevenue
    ] = await Promise.all([
      prisma.patient.count({ where: { orgId } }),
      prisma.patient.count({
        where: {
          orgId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.appointment.count({ where: { orgId } }),
      prisma.appointment.count({
        where: {
          orgId,
          appointmentDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      }),
      prisma.user.count({
        where: {
          orgId,
          role: { in: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'LabTechnician', 'Radiologist', 'Billing'] }
        }
      }),
      prisma.user.count({
        where: {
          orgId,
          status: 'active',
          role: { in: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'LabTechnician', 'Radiologist', 'Billing'] }
        }
      }),
      prisma.department.count({ where: { orgId } }),
      prisma.bed.count({ where: { orgId } }),
      prisma.bed.count({ where: { orgId, status: 'occupied' } }),
      prisma.bill.count({ where: { orgId, paymentStatus: 'pending' } }),
      prisma.bill.aggregate({
        where: {
          orgId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        },
        _sum: { totalAmount: true }
      })
    ]);

    const occupancyRate = totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(2) : 0;

    res.json({
      data: {
        patients: {
          total: totalPatients,
          today: todayPatients
        },
        appointments: {
          total: totalAppointments,
          today: todayAppointments
        },
        staff: {
          total: totalStaff,
          active: activeStaff
        },
        departments: { total: totalDepartments },
        beds: {
          total: totalBeds,
          occupied: occupiedBeds,
          available: totalBeds - occupiedBeds,
          occupancyRate: parseFloat(occupancyRate)
        },
        billing: {
          pendingPayments: pendingPayments,
          todayRevenue: todayRevenue._sum.totalAmount || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching Hospital Admin dashboard:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// ============================================================================
// DOCTOR DASHBOARD
// ============================================================================
router.get('/doctor', authenticateToken, requireRoleWithOrgScope(['HospitalAdmin', 'Doctor', 'Nurse']), async (req, res) => {
  try {
    const { orgId } = req.query;
    const doctorId = req.user.id;

    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    const [
      todayAppointments,
      pendingAppointments,
      completedAppointments,
      myPatients,
      pendingLabTests,
      pendingRadiologyTests,
      prescriptionsToday
    ] = await Promise.all([
      prisma.appointment.count({
        where: {
          orgId,
          doctorId,
          appointmentDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      }),
      prisma.appointment.count({
        where: {
          orgId,
          doctorId,
          status: 'scheduled'
        }
      }),
      prisma.appointment.count({
        where: {
          orgId,
          doctorId,
          status: 'completed'
        }
      }),
      prisma.appointment.groupBy({
        by: ['patientId'],
        where: {
          orgId,
          doctorId
        }
      }),
      prisma.labTest.count({
        where: {
          orgId,
          orderedById: doctorId,
          status: 'pending'
        }
      }),
      prisma.radiologyTest.count({
        where: {
          orgId,
          orderedById: doctorId,
          status: 'pending'
        }
      }),
      prisma.prescription.count({
        where: {
          orgId,
          doctorId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    // Get today's appointment schedule
    const todaySchedule = await prisma.appointment.findMany({
      where: {
        orgId,
        doctorId,
        appointmentDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true,
            age: true,
            gender: true
          }
        }
      },
      orderBy: {
        appointmentTime: 'asc'
      }
    });

    res.json({
      data: {
        appointments: {
          today: todayAppointments,
          pending: pendingAppointments,
          completed: completedAppointments
        },
        patients: {
          total: myPatients.length
        },
        diagnostics: {
          pendingLabTests,
          pendingRadiologyTests
        },
        prescriptions: {
          today: prescriptionsToday
        },
        todaySchedule
      }
    });
  } catch (error) {
    console.error('Error fetching Doctor dashboard:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// ============================================================================
// NURSE DASHBOARD
// ============================================================================
router.get('/nurse', authenticateToken, requireRoleWithOrgScope(['HospitalAdmin', 'Doctor', 'Nurse']), async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    const [
      totalPatients,
      ipdPatients,
      pendingLabTests,
      pendingMedications,
      todayAppointments,
      criticalPatients
    ] = await Promise.all([
      prisma.patient.count({ where: { orgId } }),
      prisma.ipdAdmission.count({
        where: {
          orgId,
          status: 'admitted'
        }
      }),
      prisma.labTest.count({
        where: {
          orgId,
          status: { in: ['pending', 'in_progress'] }
        }
      }),
      prisma.prescription.count({
        where: {
          orgId,
          status: 'active'
        }
      }),
      prisma.appointment.count({
        where: {
          orgId,
          appointmentDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      }),
      prisma.ipdAdmission.count({
        where: {
          orgId,
          status: 'admitted',
          patientCondition: 'critical'
        }
      })
    ]);

    res.json({
      data: {
        patients: {
          total: totalPatients,
          ipd: ipdPatients,
          critical: criticalPatients
        },
        tasks: {
          pendingLabTests,
          pendingMedications
        },
        appointments: {
          today: todayAppointments
        }
      }
    });
  } catch (error) {
    console.error('Error fetching Nurse dashboard:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// ============================================================================
// RECEPTIONIST DASHBOARD
// ============================================================================
router.get('/receptionist', authenticateToken, requireRoleWithOrgScope(['HospitalAdmin', 'Doctor', 'Nurse']), async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    const [
      todayAppointments,
      pendingAppointments,
      completedAppointments,
      cancelledAppointments,
      todayRegistrations,
      pendingBills,
      opdQueue
    ] = await Promise.all([
      prisma.appointment.count({
        where: {
          orgId,
          appointmentDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      }),
      prisma.appointment.count({
        where: {
          orgId,
          status: 'scheduled'
        }
      }),
      prisma.appointment.count({
        where: {
          orgId,
          status: 'completed',
          appointmentDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.appointment.count({
        where: {
          orgId,
          status: 'cancelled',
          appointmentDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.patient.count({
        where: {
          orgId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.bill.count({
        where: {
          orgId,
          paymentStatus: 'pending'
        }
      }),
      prisma.opdToken.count({
        where: {
          orgId,
          status: { in: ['waiting', 'called'] },
          tokenDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    res.json({
      data: {
        appointments: {
          today: todayAppointments,
          pending: pendingAppointments,
          completed: completedAppointments,
          cancelled: cancelledAppointments
        },
        registrations: {
          today: todayRegistrations
        },
        billing: {
          pendingBills
        },
        opd: {
          queueCount: opdQueue
        }
      }
    });
  } catch (error) {
    console.error('Error fetching Receptionist dashboard:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// ============================================================================
// PHARMACIST DASHBOARD
// ============================================================================
router.get('/pharmacist', authenticateToken, requireRoleWithOrgScope(['HospitalAdmin', 'Doctor', 'Nurse']), async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    const [
      totalMedicines,
      lowStockMedicines,
      expiringSoon,
      pendingPrescriptions,
      dispensedToday,
      totalInventoryValue
    ] = await Promise.all([
      prisma.inventoryItem.count({
        where: { orgId, category: 'medicine' }
      }),
      prisma.inventoryItem.count({
        where: {
          orgId,
          category: 'medicine',
          stockQuantity: {
            lte: prisma.inventoryItem.fields.reorderLevel
          }
        }
      }),
      prisma.inventoryItem.count({
        where: {
          orgId,
          category: 'medicine',
          expiryDate: {
            lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
          }
        }
      }),
      prisma.prescription.count({
        where: {
          orgId,
          status: 'pending'
        }
      }),
      prisma.prescription.count({
        where: {
          orgId,
          status: 'dispensed',
          updatedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.inventoryItem.aggregate({
        where: {
          orgId,
          category: 'medicine'
        },
        _sum: {
          unitPrice: true
        }
      })
    ]);

    res.json({
      data: {
        medicines: {
          total: totalMedicines,
          lowStock: lowStockMedicines,
          expiringSoon
        },
        prescriptions: {
          pending: pendingPrescriptions,
          dispensedToday
        },
        inventory: {
          totalValue: totalInventoryValue._sum.unitPrice || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching Pharmacist dashboard:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// ============================================================================
// LAB TECHNICIAN DASHBOARD
// ============================================================================
router.get('/lab-technician', authenticateToken, requireRoleWithOrgScope(['HospitalAdmin', 'Doctor', 'Nurse']), async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    const [
      pendingTests,
      inProgressTests,
      completedToday,
      urgentTests,
      totalTestsThisMonth
    ] = await Promise.all([
      prisma.labTest.count({
        where: {
          orgId,
          status: 'pending'
        }
      }),
      prisma.labTest.count({
        where: {
          orgId,
          status: 'in_progress'
        }
      }),
      prisma.labTest.count({
        where: {
          orgId,
          status: 'completed',
          updatedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.labTest.count({
        where: {
          orgId,
          status: { in: ['pending', 'in_progress'] },
          urgency: 'urgent'
        }
      }),
      prisma.labTest.count({
        where: {
          orgId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    res.json({
      data: {
        tests: {
          pending: pendingTests,
          inProgress: inProgressTests,
          completedToday,
          urgent: urgentTests,
          thisMonth: totalTestsThisMonth
        }
      }
    });
  } catch (error) {
    console.error('Error fetching Lab Technician dashboard:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// ============================================================================
// RADIOLOGIST DASHBOARD
// ============================================================================
router.get('/radiologist', authenticateToken, requireRoleWithOrgScope(['HospitalAdmin', 'Doctor', 'Nurse']), async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    const [
      pendingTests,
      inProgressTests,
      completedToday,
      urgentTests,
      totalTestsThisMonth
    ] = await Promise.all([
      prisma.radiologyTest.count({
        where: {
          orgId,
          status: 'pending'
        }
      }),
      prisma.radiologyTest.count({
        where: {
          orgId,
          status: 'in_progress'
        }
      }),
      prisma.radiologyTest.count({
        where: {
          orgId,
          status: 'completed',
          updatedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.radiologyTest.count({
        where: {
          orgId,
          status: { in: ['pending', 'in_progress'] },
          urgency: 'urgent'
        }
      }),
      prisma.radiologyTest.count({
        where: {
          orgId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    res.json({
      data: {
        tests: {
          pending: pendingTests,
          inProgress: inProgressTests,
          completedToday,
          urgent: urgentTests,
          thisMonth: totalTestsThisMonth
        }
      }
    });
  } catch (error) {
    console.error('Error fetching Radiologist dashboard:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// ============================================================================
// BILLING DASHBOARD
// ============================================================================
router.get('/billing', authenticateToken, requireRoleWithOrgScope(['HospitalAdmin', 'Doctor', 'Nurse']), async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    const [
      pendingBills,
      paidToday,
      totalPendingAmount,
      totalCollectedToday,
      totalCollectedThisMonth,
      overduePayments
    ] = await Promise.all([
      prisma.bill.count({
        where: {
          orgId,
          paymentStatus: 'pending'
        }
      }),
      prisma.bill.count({
        where: {
          orgId,
          paymentStatus: 'paid',
          updatedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      prisma.bill.aggregate({
        where: {
          orgId,
          paymentStatus: 'pending'
        },
        _sum: {
          totalAmount: true
        }
      }),
      prisma.bill.aggregate({
        where: {
          orgId,
          paymentStatus: 'paid',
          updatedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        },
        _sum: {
          totalAmount: true
        }
      }),
      prisma.bill.aggregate({
        where: {
          orgId,
          paymentStatus: 'paid',
          updatedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: {
          totalAmount: true
        }
      }),
      prisma.bill.count({
        where: {
          orgId,
          paymentStatus: 'pending',
          dueDate: {
            lt: new Date()
          }
        }
      })
    ]);

    res.json({
      data: {
        bills: {
          pending: pendingBills,
          paidToday,
          overdue: overduePayments
        },
        revenue: {
          pendingAmount: totalPendingAmount._sum.totalAmount || 0,
          collectedToday: totalCollectedToday._sum.totalAmount || 0,
          collectedThisMonth: totalCollectedThisMonth._sum.totalAmount || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching Billing dashboard:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

module.exports = router;
