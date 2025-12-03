// Radiology Module Routes - Imaging Tests, Results & Reports
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const {
  requirePermission,
  requireAdmin,
  requireSuperAdmin,
  enforceOrgScope
} = require('../middleware/rbac');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'hospital-saas-jwt-secret-2024';

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      errors: [{ message: 'Access token required' }]
    });
  }

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

// Helper to get user's org ID (SuperAdmin can see all)
function getUserOrgId(req) {
  if (req.query.orgId && req.user.role === 'SuperAdmin') {
    return req.query.orgId;
  }
  return req.user.orgId || req.query.orgId;
}

// Helper to generate radiology order number
async function generateRadiologyOrderNumber(orgId) {
  const year = new Date().getFullYear();
  const count = await prisma.radiologyTest.count({
    where: {
      orgId,
      orderNumber: {
        startsWith: `RAD${year}`
      }
    }
  });

  const paddedNumber = String(count + 1).padStart(6, '0');
  return `RAD${year}${paddedNumber}`;
}

// Helper to generate radiology test code (uses testCode field in schema)
async function generateRadiologyTestCode(orgId) {
  const year = new Date().getFullYear();
  const count = await prisma.radiologyTest.count({
    where: {
      orgId,
      testCode: {
        startsWith: `RAD${year}`
      }
    }
  });

  const paddedNumber = String(count + 1).padStart(6, '0');
  return `RAD${year}${paddedNumber}`;
}

// ============== RADIOLOGY TEST ORDERS ==============

// GET all radiology test orders
router.get('/tests', authenticateToken, requirePermission('RADIOLOGY_ORDER'), async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const {
      patientId,
      status,
      urgency,
      modality,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const where = {};
    if (orgId) where.orgId = orgId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (urgency) where.urgency = urgency;
    if (modality) where.modality = modality;

    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate.gte = new Date(startDate);
      if (endDate) where.orderDate.lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tests, total] = await Promise.all([
      prisma.radiologyTest.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              patientCode: true,
              age: true,
              gender: true
            }
          },
          orderedByDoctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { orderDate: 'desc' }
      }),
      prisma.radiologyTest.count({ where })
    ]);

    res.json({
      data: tests,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get radiology tests error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// GET single radiology test by ID
router.get('/tests/:id', authenticateToken, requirePermission('RADIOLOGY_ORDER'), async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = { id: req.params.id };
    if (orgId) where.orgId = orgId;

    const test = await prisma.radiologyTest.findUnique({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true,
            age: true,
            gender: true,
            mobile: true
          }
        },
        orderedByDoctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialization: true
          }
        }
      }
    });

    if (!test) {
      return res.status(404).json({
        errors: [{ message: 'Radiology test not found' }]
      });
    }

    res.json({ data: test });
  } catch (error) {
    console.error('Get radiology test error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// POST create new radiology test order
router.post('/tests', authenticateToken, requirePermission('RADIOLOGY_ORDER'), async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const {
      patientId,
      doctorId,
      testName,
      modality,
      bodyPart,
      urgency = 'routine',
      orderDate,
      clinicalHistory, // test sends this - map to findings
      findings,        // schema field
      impression,      // schema field
      orderedBy,       // schema field
      charges          // schema field
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        errors: [{ message: 'Patient ID is required' }]
      });
    }

    if (!testName) {
      return res.status(400).json({
        errors: [{ message: 'Test name is required' }]
      });
    }

    if (!modality) {
      return res.status(400).json({
        errors: [{ message: 'Modality is required (X-Ray, CT, MRI, Ultrasound, etc.)' }]
      });
    }

    // Generate test code (not order number)
    const testCode = await generateRadiologyTestCode(orgId);

    const test = await prisma.radiologyTest.create({
      data: {
        orgId,
        patientId,
        doctorId,
        testCode,          // schema uses testCode
        testName,
        testType: modality, // schema uses testType
        modality,
        bodyPart,
        urgency,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        status: 'ordered',
        findings: clinicalHistory || findings, // clinicalHistory is alias for findings
        impression,
        orderedBy,
        charges
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true
          }
        },
        orderedByDoctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(201).json({ data: test });
  } catch (error) {
    console.error('Create radiology test error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// PATCH update radiology test
router.patch('/tests/:id', authenticateToken, requirePermission('RADIOLOGY_PROCESS'), async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = { id: req.params.id };
    if (orgId) where.orgId = orgId;

    const {
      urgency,
      scheduledDate,
      clinicalIndication,
      instructions,
      status
    } = req.body;

    const updateData = {};
    if (urgency !== undefined) updateData.urgency = urgency;
    if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate ? new Date(scheduledDate) : null;
    if (clinicalIndication !== undefined) updateData.clinicalIndication = clinicalIndication;
    if (instructions !== undefined) updateData.instructions = instructions;
    if (status !== undefined) updateData.status = status;

    const test = await prisma.radiologyTest.update({
      where,
      data: updateData,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true
          }
        },
        orderedByDoctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.json({ data: test });
  } catch (error) {
    console.error('Update radiology test error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// POST cancel radiology test
router.post('/tests/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = { id: req.params.id };
    if (orgId) where.orgId = orgId;

    const { cancellationReason } = req.body;

    const test = await prisma.radiologyTest.update({
      where,
      data: {
        status: 'cancelled'
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true
          }
        }
      }
    });

    res.json({ data: test });
  } catch (error) {
    console.error('Cancel radiology test error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// ============== IMAGE UPLOAD & MANAGEMENT ==============

// GET images for a radiology test
router.get('/tests/:testId/images', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { testId } = req.params;

    // Verify test belongs to org
    const test = await prisma.radiologyTest.findFirst({
      where: {
        id: testId,
        ...(orgId && { orgId })
      }
    });

    if (!test) {
      return res.status(404).json({
        errors: [{ message: 'Radiology test not found' }]
      });
    }

    const images = await prisma.radiologyImage.findMany({
      where: { radiologyTestId: testId },
      orderBy: { uploadedAt: 'desc' }
    });

    res.json({ data: images });
  } catch (error) {
    console.error('Get images error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// POST upload/record radiology image
router.post('/tests/:testId/images', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { testId } = req.params;
    const {
      imageUrl,
      imageType,
      seriesNumber,
      instanceNumber,
      viewPosition,
      uploadedBy,
      fileSize,
      resolution,
      dicomMetadata,
      notes
    } = req.body;

    // Verify test belongs to org
    const test = await prisma.radiologyTest.findFirst({
      where: {
        id: testId,
        ...(orgId && { orgId })
      }
    });

    if (!test) {
      return res.status(404).json({
        errors: [{ message: 'Radiology test not found' }]
      });
    }

    if (!imageUrl) {
      return res.status(400).json({
        errors: [{ message: 'Image URL is required' }]
      });
    }

    // Create image record and update test status in transaction
    const image = await prisma.$transaction(async (tx) => {
      const newImage = await tx.radiologyImage.create({
        data: {
          radiologyTestId: testId,
          imageUrl,
          imageType: imageType || 'DICOM',
          seriesNumber,
          instanceNumber,
          viewPosition,
          uploadedBy,
          uploadedAt: new Date(),
          fileSize,
          resolution,
          dicomMetadata,
          notes
        }
      });

      // Update test status if it was 'ordered' or 'scheduled'
      if (test.status === 'ordered' || test.status === 'scheduled') {
        await tx.radiologyTest.update({
          where: { id: testId },
          data: { status: 'image_captured' }
        });
      }

      return newImage;
    });

    res.status(201).json({ data: image });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// DELETE radiology image
router.delete('/images/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.radiologyImage.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// ============== RADIOLOGY RESULTS & REPORTS ==============

// POST enter radiology results
router.post('/tests/:testId/results', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { testId } = req.params;
    const {
      findings,
      impression,
      radiologistId,
      radiologistName,
      reportDate,
      techniqueSummary,
      comparison,
      recommendations
    } = req.body;

    // Verify test belongs to org
    const test = await prisma.radiologyTest.findFirst({
      where: {
        id: testId,
        ...(orgId && { orgId })
      }
    });

    if (!test) {
      return res.status(404).json({
        errors: [{ message: 'Radiology test not found' }]
      });
    }

    if (!findings) {
      return res.status(400).json({
        errors: [{ message: 'Findings are required' }]
      });
    }

    // Update test with results
    const updatedTest = await prisma.radiologyTest.update({
      where: { id: testId },
      data: {
        findings,
        impression,
        radiologistId,
        radiologistName,
        reportDate: reportDate ? new Date(reportDate) : new Date(),
        techniqueSummary,
        comparison,
        recommendations,
        status: 'completed'
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true
          }
        },
        orderedByDoctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.json({ data: updatedTest });
  } catch (error) {
    console.error('Enter radiology results error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// GET radiology results
router.get('/tests/:testId/results', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { testId } = req.params;

    const test = await prisma.radiologyTest.findFirst({
      where: {
        id: testId,
        ...(orgId && { orgId })
      },
      select: {
        id: true,
        orderNumber: true,
        testName: true,
        modality: true,
        bodyPart: true,
        findings: true,
        impression: true,
        techniqueSummary: true,
        comparison: true,
        recommendations: true,
        reportDate: true,
        radiologistName: true,
        status: true,
        contrast: true,
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true,
            age: true,
            gender: true
          }
        },
        orderedByDoctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialization: true
          }
        }
      }
    });

    if (!test) {
      return res.status(404).json({
        errors: [{ message: 'Radiology test not found' }]
      });
    }

    if (!test.findings) {
      return res.status(404).json({
        errors: [{ message: 'Results not yet available' }]
      });
    }

    res.json({ data: test });
  } catch (error) {
    console.error('Get radiology results error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// GET radiology report (formatted for printing/PDF)
router.get('/tests/:testId/report', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { testId } = req.params;

    const test = await prisma.radiologyTest.findFirst({
      where: {
        id: testId,
        ...(orgId && { orgId }),
        status: 'completed'
      },
      include: {
        patient: true,
        orderedByDoctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialization: true,
            licenseNumber: true
          }
        }
      }
    });

    if (!test) {
      return res.status(404).json({
        errors: [{ message: 'Radiology test not found or not completed' }]
      });
    }

    // Format report data
    const report = {
      reportId: test.orderNumber,
      reportDate: test.reportDate || new Date(),
      patient: {
        name: test.patient.name,
        patientCode: test.patient.patientCode,
        age: test.patient.age,
        gender: test.patient.gender,
        phone: test.patient.mobile
      },
      examination: {
        name: test.testName,
        modality: test.modality,
        bodyPart: test.bodyPart,
        orderDate: test.orderDate,
        scheduledDate: test.scheduledDate,
        reportDate: test.reportDate,
        contrast: test.contrast
      },
      referringDoctor: test.orderedByDoctor ? {
        name: `${test.orderedByDoctor.firstName} ${test.orderedByDoctor.lastName}`,
        specialization: test.orderedByDoctor.specialization,
        license: test.orderedByDoctor.licenseNumber
      } : null,
      clinicalIndication: test.clinicalIndication,
      technique: test.techniqueSummary,
      comparison: test.comparison,
      findings: test.findings,
      impression: test.impression,
      recommendations: test.recommendations,
      radiologist: test.radiologistName,
      images: []
    };

    res.json({ data: report });
  } catch (error) {
    console.error('Get radiology report error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// ============== RADIOLOGY STATISTICS ==============

// GET radiology statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { startDate, endDate } = req.query;

    const where = {};
    if (orgId) where.orgId = orgId;

    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate.gte = new Date(startDate);
      if (endDate) where.orderDate.lte = new Date(endDate);
    }

    const [
      totalTests,
      orderedTests,
      scheduledTests,
      capturedTests,
      completedTests,
      cancelledTests,
      urgentTests,
      averageCompletionTime
    ] = await Promise.all([
      prisma.radiologyTest.count({ where }),
      prisma.radiologyTest.count({ where: { ...where, status: 'ordered' } }),
      prisma.radiologyTest.count({ where: { ...where, status: 'scheduled' } }),
      prisma.radiologyTest.count({ where: { ...where, status: 'image_captured' } }),
      prisma.radiologyTest.count({ where: { ...where, status: 'completed' } }),
      prisma.radiologyTest.count({ where: { ...where, status: 'cancelled' } }),
      prisma.radiologyTest.count({ where: { ...where, urgency: 'urgent' } }),
      prisma.radiologyTest.findMany({
        where: {
          ...where,
          status: 'completed',
          reportDate: { not: null }
        },
        select: {
          orderDate: true,
          reportDate: true
        }
      })
    ]);

    // Calculate average completion time in hours
    let avgHours = 0;
    if (averageCompletionTime.length > 0) {
      const totalHours = averageCompletionTime.reduce((sum, test) => {
        const diff = new Date(test.reportDate) - new Date(test.orderDate);
        return sum + (diff / (1000 * 60 * 60));
      }, 0);
      avgHours = totalHours / averageCompletionTime.length;
    }

    // Get modality breakdown
    const modalityBreakdown = await prisma.radiologyTest.groupBy({
      by: ['modality'],
      where,
      _count: true
    });

    // Get body part breakdown
    const bodyPartBreakdown = await prisma.radiologyTest.groupBy({
      by: ['bodyPart'],
      where,
      _count: true
    });

    res.json({
      data: {
        summary: {
          total: totalTests,
          ordered: orderedTests,
          scheduled: scheduledTests,
          imageCaptured: capturedTests,
          completed: completedTests,
          cancelled: cancelledTests,
          urgent: urgentTests
        },
        performance: {
          averageCompletionTimeHours: Math.round(avgHours * 100) / 100,
          completionRate: totalTests > 0 ? ((completedTests / totalTests) * 100).toFixed(2) : 0
        },
        modalityBreakdown: modalityBreakdown.map(mod => ({
          modality: mod.modality || 'Unknown',
          count: mod._count
        })),
        bodyPartBreakdown: bodyPartBreakdown.slice(0, 10).map(part => ({
          bodyPart: part.bodyPart || 'Unspecified',
          count: part._count
        }))
      }
    });
  } catch (error) {
    console.error('Get radiology stats error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

module.exports = router;
