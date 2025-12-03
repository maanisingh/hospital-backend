// Appointment Management APIs
// Handles: Appointment booking, rescheduling, cancellations, reminders
// Multi-tenant with orgId filtering

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('✅ Appointment Management routes loaded');

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

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

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      errors: [{ message: 'Invalid or expired token' }]
    });
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getUserOrgId(req) {
  if (req.user.role === 'SuperAdmin') {
    const orgId = req.query.orgId;
    if (!orgId) {
      throw new Error('SuperAdmin must provide orgId parameter');
    }
    return orgId;
  } else {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    if (!user || !user.orgId) {
      throw new Error('User not associated with any organization');
    }
    return user.orgId;
  }
}

async function generateAppointmentNumber(orgId) {
  const count = await prisma.appointment.count({ where: { orgId } });
  const year = new Date().getFullYear();
  return `APT${year}${String(count + 1).padStart(6, '0')}`;
}

function checkTimeSlotAvailability(appointments, startTime, endTime) {
  const newStart = new Date(startTime);
  const newEnd = new Date(endTime);

  for (const apt of appointments) {
    const existingStart = new Date(apt.appointmentDate);
    const existingEnd = new Date(existingStart.getTime() + apt.duration * 60000);

    // Check for overlap
    if (
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    ) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// APPOINTMENT CRUD OPERATIONS
// ============================================================================

// GET /api/appointments - List all appointments (with filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const {
      patientId,
      doctorId,
      departmentId,
      status,
      date,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = { orgId };

    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      where.appointmentDate = {
        gte: startOfDay,
        lte: endOfDay
      };
    } else if (startDate && endDate) {
      where.appointmentDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              mobile: true,
              age: true,
              gender: true
            }
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { appointmentDate: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.appointment.count({ where })
    ]);

    res.json({
      data: appointments,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List appointments error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to fetch appointments' }]
    });
  }
});

// GET /api/appointments/:id - Get single appointment
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;

    const appointment = await prisma.appointment.findFirst({
      where: { id, orgId },
      include: {
        patient: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!appointment) {
      return res.status(404).json({
        errors: [{ message: 'Appointment not found' }]
      });
    }

    res.json({ data: appointment });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to fetch appointment' }]
    });
  }
});

// POST /api/appointments - Create new appointment
router.post('/', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const {
      patientId,
      doctorId,
      departmentId,
      appointmentDate,
      appointmentTime,
      duration = 30, // minutes
      appointmentType = 'consultation',
      reason,
      notes,
      priority = 'normal'
    } = req.body;

    // Validate required fields
    if (!patientId || !appointmentDate) {
      return res.status(400).json({
        errors: [{ message: 'Patient and Appointment Date are required' }]
      });
    }

    // Verify patient exists
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, orgId }
    });
    if (!patient) {
      return res.status(404).json({
        errors: [{ message: 'Patient not found' }]
      });
    }

    // Note: Doctor verification skipped to allow flexible doctor assignment
    // In production, you may want to add validation based on your requirements

    // Parse appointment date and extract time
    const aptDate = new Date(appointmentDate);

    // Extract or use appointmentTime
    // If not provided, extract from appointmentDate (ISO string)
    const timeString = appointmentTime || aptDate.toTimeString().substring(0, 5); // "HH:MM" format

    // Check if time slot is available
    const endTime = new Date(aptDate.getTime() + duration * 60000);

    const conflictingAppointments = await prisma.appointment.findMany({
      where: {
        orgId,
        doctorId,
        status: { in: ['scheduled', 'confirmed'] },
        appointmentDate: {
          gte: new Date(aptDate.getTime() - 2 * 60 * 60000), // 2 hours before
          lte: new Date(aptDate.getTime() + 2 * 60 * 60000)  // 2 hours after
        }
      }
    });

    if (!checkTimeSlotAvailability(conflictingAppointments, aptDate, endTime)) {
      return res.status(409).json({
        errors: [{ message: 'Time slot not available. Please choose a different time.' }]
      });
    }

    // Note: appointmentNumber removed - not in schema

    // Create appointment
    const includeOptions = {
      patient: true
    };

    // Only include doctor if doctorId is provided and valid
    if (doctorId) {
      includeOptions.doctor = {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      };
    }

    const appointment = await prisma.appointment.create({
      data: {
        orgId,
        patientId,
        doctorId,
        appointmentDate: aptDate,
        appointmentTime: timeString,
        appointmentType,
        reason,
        notes,
        status: 'scheduled'
      },
      include: includeOptions
    });

    res.status(201).json({ data: appointment });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to create appointment' }]
    });
  }
});

// PATCH /api/appointments/:id - Update appointment
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;
    const updates = req.body;

    // Check if appointment exists
    const existingAppointment = await prisma.appointment.findFirst({
      where: { id, orgId }
    });

    if (!existingAppointment) {
      return res.status(404).json({
        errors: [{ message: 'Appointment not found' }]
      });
    }

    // If rescheduling, check availability
    if (updates.appointmentDate && updates.appointmentDate !== existingAppointment.appointmentDate) {
      const aptDate = new Date(updates.appointmentDate);
      const duration = updates.duration || existingAppointment.duration;
      const endTime = new Date(aptDate.getTime() + duration * 60000);

      const conflictingAppointments = await prisma.appointment.findMany({
        where: {
          orgId,
          doctorId: existingAppointment.doctorId,
          id: { not: id },
          status: { in: ['scheduled', 'confirmed'] },
          appointmentDate: {
            gte: new Date(aptDate.getTime() - 2 * 60 * 60000),
            lte: new Date(aptDate.getTime() + 2 * 60 * 60000)
          }
        }
      });

      if (!checkTimeSlotAvailability(conflictingAppointments, aptDate, endTime)) {
        return res.status(409).json({
          errors: [{ message: 'Time slot not available. Please choose a different time.' }]
        });
      }
    }

    // Update appointment
    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: updates,
      include: {
        patient: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({ data: updatedAppointment });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to update appointment' }]
    });
  }
});

// POST /api/appointments/:id/confirm - Confirm appointment
router.post('/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;

    const appointment = await prisma.appointment.findFirst({
      where: { id, orgId }
    });

    if (!appointment) {
      return res.status(404).json({
        errors: [{ message: 'Appointment not found' }]
      });
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'confirmed'
        // Note: confirmedAt field doesn't exist in schema
      },
      include: {
        patient: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({ data: updatedAppointment });
  } catch (error) {
    console.error('Confirm appointment error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to confirm appointment' }]
    });
  }
});

// POST /api/appointments/:id/cancel - Cancel appointment
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;
    const { cancellationReason } = req.body;

    const appointment = await prisma.appointment.findFirst({
      where: { id, orgId }
    });

    if (!appointment) {
      return res.status(404).json({
        errors: [{ message: 'Appointment not found' }]
      });
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancellationReason,
        cancelledAt: new Date()
      },
      include: {
        patient: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({ data: updatedAppointment });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to cancel appointment' }]
    });
  }
});

// POST /api/appointments/:id/complete - Mark appointment as completed
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;
    const { notes } = req.body;

    const appointment = await prisma.appointment.findFirst({
      where: { id, orgId }
    });

    if (!appointment) {
      return res.status(404).json({
        errors: [{ message: 'Appointment not found' }]
      });
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'completed',
        notes: notes || appointment.notes,
        completedAt: new Date()
      },
      include: {
        patient: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({ data: updatedAppointment });
  } catch (error) {
    console.error('Complete appointment error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to complete appointment' }]
    });
  }
});

// DELETE /api/appointments/:id - Delete appointment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;

    const appointment = await prisma.appointment.findFirst({
      where: { id, orgId }
    });

    if (!appointment) {
      return res.status(404).json({
        errors: [{ message: 'Appointment not found' }]
      });
    }

    await prisma.appointment.delete({
      where: { id }
    });

    res.json({
      data: { message: 'Appointment deleted successfully' }
    });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to delete appointment' }]
    });
  }
});

// ============================================================================
// AVAILABILITY & SCHEDULING
// ============================================================================

// GET /api/appointments/availability/:doctorId - Get doctor's available slots
router.get('/availability/:doctorId', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        errors: [{ message: 'Date parameter is required' }]
      });
    }

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all appointments for this doctor on this date
    const appointments = await prisma.appointment.findMany({
      where: {
        orgId,
        doctorId,
        status: { in: ['scheduled', 'confirmed'] },
        appointmentDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: { appointmentDate: 'asc' }
    });

    // Generate available time slots (9 AM to 5 PM, 30-minute slots)
    const slots = [];
    const workStart = new Date(targetDate);
    workStart.setHours(9, 0, 0, 0);
    const workEnd = new Date(targetDate);
    workEnd.setHours(17, 0, 0, 0);

    let currentSlot = new Date(workStart);
    while (currentSlot < workEnd) {
      const slotEnd = new Date(currentSlot.getTime() + 30 * 60000);
      const isAvailable = checkTimeSlotAvailability(appointments, currentSlot, slotEnd);

      slots.push({
        startTime: new Date(currentSlot),
        endTime: slotEnd,
        available: isAvailable
      });

      currentSlot = new Date(currentSlot.getTime() + 30 * 60000);
    }

    res.json({
      data: {
        doctorId,
        date: targetDate,
        slots
      }
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to fetch availability' }]
    });
  }
});

// ============================================================================
// STATISTICS
// ============================================================================

// GET /api/appointments/stats - Get appointment statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { startDate, endDate, doctorId, departmentId } = req.query;

    let where = { orgId };

    if (doctorId) where.doctorId = doctorId;
    if (departmentId) where.departmentId = departmentId;

    if (startDate && endDate) {
      where.appointmentDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [
      totalAppointments,
      scheduled,
      confirmed,
      completed,
      cancelled,
      noShow
    ] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.count({ where: { ...where, status: 'scheduled' } }),
      prisma.appointment.count({ where: { ...where, status: 'confirmed' } }),
      prisma.appointment.count({ where: { ...where, status: 'completed' } }),
      prisma.appointment.count({ where: { ...where, status: 'cancelled' } }),
      prisma.appointment.count({ where: { ...where, status: 'no_show' } })
    ]);

    const stats = {
      totalAppointments,
      scheduled,
      confirmed,
      completed,
      cancelled,
      noShow,
      completionRate: totalAppointments > 0
        ? ((completed / totalAppointments) * 100).toFixed(2)
        : 0
    };

    res.json({ data: stats });
  } catch (error) {
    console.error('Get appointment stats error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to fetch appointment stats' }]
    });
  }
});

module.exports = router;
