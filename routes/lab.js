// Lab Module Routes - Lab Tests, Samples, Results & Reports
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

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

// Helper to generate lab order number
async function generateLabOrderNumber(orgId) {
  const year = new Date().getFullYear();
  const count = await prisma.labTest.count({
    where: {
      orgId,
      orderNumber: {
        startsWith: `LAB${year}`
      }
    }
  });

  const paddedNumber = String(count + 1).padStart(6, '0');
  return `LAB${year}${paddedNumber}`;
}

// Helper to generate lab test code (uses testCode field in schema)
async function generateLabTestCode(orgId) {
  const year = new Date().getFullYear();
  const count = await prisma.labTest.count({
    where: {
      orgId,
      testCode: {
        startsWith: `LAB${year}`
      }
    }
  });

  const paddedNumber = String(count + 1).padStart(6, '0');
  return `LAB${year}${paddedNumber}`;
}

// ============== LAB TEST ORDERS ==============

// GET all lab test orders
router.get('/tests', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const {
      patientId,
      status,
      urgency,
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

    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate.gte = new Date(startDate);
      if (endDate) where.orderDate.lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tests, total] = await Promise.all([
      prisma.labTest.findMany({
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
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { orderDate: 'desc' }
      }),
      prisma.labTest.count({ where })
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
    console.error('Get lab tests error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// GET single lab test by ID
router.get('/tests/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = { id: req.params.id };
    if (orgId) where.orgId = orgId;

    const test = await prisma.labTest.findUnique({
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
        }
      }
    });

    if (!test) {
      return res.status(404).json({
        errors: [{ message: 'Lab test not found' }]
      });
    }

    res.json({ data: test });
  } catch (error) {
    console.error('Get lab test error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// POST create new lab test order
router.post('/tests', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const {
      patientId,
      testName,
      testCategory,
      urgency = 'routine',
      priority, // alias for urgency
      orderDate,
      orderedBy,
      remarks,
      charges
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

    // Generate test code
    const testCode = await generateLabTestCode(orgId);

    const test = await prisma.labTest.create({
      data: {
        orgId,
        patientId,
        testCode,
        testName,
        testCategory,
        urgency: priority || urgency, // priority is alias for urgency
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        orderedBy,
        status: 'ordered',
        remarks,
        charges
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

    res.status(201).json({ data: test });
  } catch (error) {
    console.error('Create lab test error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// PATCH update lab test
router.patch('/tests/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = { id: req.params.id };
    if (orgId) where.orgId = orgId;

    const {
      urgency,
      clinicalNotes,
      instructions,
      status
    } = req.body;

    const updateData = {};
    if (urgency !== undefined) updateData.urgency = urgency;
    if (clinicalNotes !== undefined) updateData.clinicalNotes = clinicalNotes;
    if (instructions !== undefined) updateData.instructions = instructions;
    if (status !== undefined) updateData.status = status;

    const test = await prisma.labTest.update({
      where,
      data: updateData,
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
    console.error('Update lab test error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// POST cancel lab test
router.post('/tests/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = { id: req.params.id };
    if (orgId) where.orgId = orgId;

    const { cancellationReason } = req.body;

    const test = await prisma.labTest.update({
      where,
      data: {
        status: 'cancelled',
        cancellationReason,
        cancelledAt: new Date()
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
    console.error('Cancel lab test error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// ============== SAMPLE COLLECTION ==============

// GET sample info for a lab test
router.get('/tests/:testId/samples', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { testId } = req.params;

    // Get test with sample info
    const where = { id: testId };
    if (orgId) where.orgId = orgId;

    const test = await prisma.labTest.findFirst({
      where,
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

    if (!test) {
      return res.status(404).json({
        errors: [{ message: 'Lab test not found' }]
      });
    }

    // Return test with sample date info
    res.json({ data: {
      testId: test.id,
      sampleDate: test.sampleDate,
      status: test.status,
      remarks: test.remarks,
      patient: test.patient
    }});
  } catch (error) {
    console.error('Get samples error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// POST record sample collection
router.post('/tests/:testId/samples', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { testId } = req.params;
    const {
      sampleType,
      collectedBy,
      collectedAt
    } = req.body;

    // Verify test belongs to org
    const where = { id: testId };
    if (orgId) where.orgId = orgId;

    const test = await prisma.labTest.findFirst({
      where
    });

    if (!test) {
      return res.status(404).json({
        errors: [{ message: 'Lab test not found' }]
      });
    }

    // Update test with sample collection info
    const updatedTest = await prisma.labTest.update({
      where: { id: testId },
      data: {
        sampleDate: collectedAt ? new Date(collectedAt) : new Date(),
        status: 'sample_collected',
        remarks: `Sample collected by ${collectedBy || 'staff'}. Type: ${sampleType || 'unspecified'}`
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

    res.status(201).json({ data: updatedTest });
  } catch (error) {
    console.error('Record sample error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// ============== TEST RESULTS ==============

// POST enter test results
router.post('/tests/:testId/results', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { testId } = req.params;
    const {
      results,
      interpretation,
      performedBy,
      verifiedBy,
      resultDate,
      abnormalFlags,
      comments
    } = req.body;

    // Verify test belongs to org
    const test = await prisma.labTest.findFirst({
      where: {
        id: testId,
        ...(orgId && { orgId })
      }
    });

    if (!test) {
      return res.status(404).json({
        errors: [{ message: 'Lab test not found' }]
      });
    }

    if (!results) {
      return res.status(400).json({
        errors: [{ message: 'Results are required' }]
      });
    }

    // Update test with results
    const updatedTest = await prisma.labTest.update({
      where: { id: testId },
      data: {
        results,
        interpretation,
        performedBy,
        verifiedBy,
        resultDate: resultDate ? new Date(resultDate) : new Date(),
        abnormalFlags,
        comments,
        status: 'completed',
        completedAt: new Date()
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

    res.json({ data: updatedTest });
  } catch (error) {
    console.error('Enter results error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// GET test results
router.get('/tests/:testId/results', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { testId } = req.params;

    const test = await prisma.labTest.findFirst({
      where: {
        id: testId,
        ...(orgId && { orgId })
      },
      select: {
        id: true,
        orderNumber: true,
        testName: true,
        testCategory: true,
        results: true,
        interpretation: true,
        abnormalFlags: true,
        resultDate: true,
        performedBy: true,
        verifiedBy: true,
        comments: true,
        status: true,
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true,
            age: true,
            gender: true
          }
        }
      }
    });

    if (!test) {
      return res.status(404).json({
        errors: [{ message: 'Lab test not found' }]
      });
    }

    if (!test.results) {
      return res.status(404).json({
        errors: [{ message: 'Results not yet available' }]
      });
    }

    res.json({ data: test });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// ============== LAB REPORTS ==============

// GET lab report (formatted for printing/PDF)
router.get('/tests/:testId/report', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { testId } = req.params;

    const test = await prisma.labTest.findFirst({
      where: {
        id: testId,
        ...(orgId && { orgId }),
        status: 'completed'
      },
      include: {
        patient: true
      }
    });

    if (!test) {
      return res.status(404).json({
        errors: [{ message: 'Lab test not found or not completed' }]
      });
    }

    // Format report data
    const report = {
      reportId: test.orderNumber,
      reportDate: new Date(),
      patient: {
        name: test.patient.name,
        patientCode: test.patient.patientCode,
        age: test.patient.age,
        gender: test.patient.gender,
        phone: test.patient.mobile
      },
      test: {
        name: test.testName,
        category: test.testCategory,
        orderDate: test.orderDate,
        resultDate: test.resultDate
      },
      doctor: null,
      results: test.results,
      interpretation: test.interpretation,
      abnormalFlags: test.abnormalFlags,
      comments: test.comments,
      performedBy: test.performedBy,
      verifiedBy: test.verifiedBy,
      samples: []
    };

    res.json({ data: report });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// ============== LAB STATISTICS ==============

// GET lab statistics
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
      collectedTests,
      processingTests,
      completedTests,
      cancelledTests,
      urgentTests,
      averageCompletionTime
    ] = await Promise.all([
      prisma.labTest.count({ where }),
      prisma.labTest.count({ where: { ...where, status: 'ordered' } }),
      prisma.labTest.count({ where: { ...where, status: 'sample_collected' } }),
      prisma.labTest.count({ where: { ...where, status: 'processing' } }),
      prisma.labTest.count({ where: { ...where, status: 'completed' } }),
      prisma.labTest.count({ where: { ...where, status: 'cancelled' } }),
      prisma.labTest.count({ where: { ...where, urgency: 'urgent' } }),
      prisma.labTest.findMany({
        where: {
          ...where,
          status: 'completed',
          completedAt: { not: null }
        },
        select: {
          orderDate: true,
          completedAt: true
        }
      })
    ]);

    // Calculate average completion time in hours
    let avgHours = 0;
    if (averageCompletionTime.length > 0) {
      const totalHours = averageCompletionTime.reduce((sum, test) => {
        const diff = new Date(test.completedAt) - new Date(test.orderDate);
        return sum + (diff / (1000 * 60 * 60));
      }, 0);
      avgHours = totalHours / averageCompletionTime.length;
    }

    // Get test category breakdown
    const categoryBreakdown = await prisma.labTest.groupBy({
      by: ['testCategory'],
      where,
      _count: true
    });

    res.json({
      data: {
        summary: {
          total: totalTests,
          ordered: orderedTests,
          sampleCollected: collectedTests,
          processing: processingTests,
          completed: completedTests,
          cancelled: cancelledTests,
          urgent: urgentTests
        },
        performance: {
          averageCompletionTimeHours: Math.round(avgHours * 100) / 100,
          completionRate: totalTests > 0 ? ((completedTests / totalTests) * 100).toFixed(2) : 0
        },
        categoryBreakdown: categoryBreakdown.map(cat => ({
          category: cat.testCategory || 'Uncategorized',
          count: cat._count
        }))
      }
    });
  } catch (error) {
    console.error('Get lab stats error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

module.exports = router;
