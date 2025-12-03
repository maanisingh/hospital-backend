// Pharmacy Module API Routes
// Medicine inventory, prescriptions, orders, and stock management

const express = require('express');
const router = express.Router();
const { PrismaClient, Prisma } = require('@prisma/client');
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

// Helper to get orgId from user (SuperAdmin can access all orgs)
const getUserOrgId = (req) => {
  if (req.user.role === 'SuperAdmin') {
    return req.query.orgId || null; // SuperAdmin can filter by orgId or see all
  }
  return req.user.orgId || null;
};

// Helper to generate prescription order number: PRE{timestamp}{random}
const generatePrescriptionNumber = async (orgId) => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const prescriptionNumber = `PRE${timestamp}${random}`;

  // Verify uniqueness (extremely unlikely to collide, but check anyway)
  const existing = await prisma.prescription.findFirst({
    where: {
      prescriptionNumber,
      ...(orgId && { orgId })
    }
  });

  if (existing) {
    // If somehow collision occurs, add extra random digits
    return `PRE${timestamp}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  }

  return prescriptionNumber;
};

// Helper to generate pharmacy order number: PHO{timestamp}{random}
const generatePharmacyOrderNumber = async (orgId) => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const orderNumber = `PHO${timestamp}${random}`;

  // Verify uniqueness (extremely unlikely to collide, but check anyway)
  const existing = await prisma.pharmacyOrder.findFirst({
    where: {
      orderNumber,
      ...(orgId && { orgId })
    }
  });

  if (existing) {
    // If somehow collision occurs, add extra random digits
    return `PHO${timestamp}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  }

  return orderNumber;
};

// ============== MEDICINE INVENTORY API ==============

// GET all medicines in inventory
router.get('/medicines', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { category, inStock, lowStock, page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (orgId) where.orgId = orgId;
    if (category) where.category = category;
    if (inStock === 'true') where.quantity = { gt: 0 };
    // Note: lowStock filtering requires comparing quantity to reorderLevel field
    // This is handled via raw SQL query after initial fetch since Prisma doesn't support field-to-field comparison in where clause
    const fetchLowStock = lowStock === 'true';

    let [medicines, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { itemName: 'asc' }
      }),
      prisma.inventoryItem.count({ where })
    ]);

    // Filter for low stock items (quantity <= reorderLevel) if requested
    if (fetchLowStock) {
      medicines = medicines.filter(item => item.quantity <= item.reorderLevel);
    }

    res.json({
      data: medicines,
      meta: {
        total: fetchLowStock ? medicines.length : total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((fetchLowStock ? medicines.length : total) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get medicines error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// GET low stock medicines (specific route before :id to avoid matching "low-stock" as an ID)
router.get('/medicines/low-stock', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = orgId ? { orgId } : {};

    // Fetch all medicines and filter in JS since Prisma doesn't support field-to-field comparison
    const allMedicines = await prisma.inventoryItem.findMany({
      where,
      orderBy: { quantity: 'asc' }
    });

    const lowStockMedicines = allMedicines.filter(item => item.quantity <= item.reorderLevel);

    res.json({
      data: lowStockMedicines,
      count: lowStockMedicines.length
    });
  } catch (error) {
    console.error('Get low stock medicines error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// GET single medicine by ID
router.get('/medicines/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { id } = req.params;

    const medicine = await prisma.inventoryItem.findFirst({
      where: {
        id,
        ...(orgId && { orgId })
      },
      include: {
        prescriptionItems: {
          take: 10,
          orderBy: { dateCreated: 'desc' }
        }
      }
    });

    if (!medicine) {
      return res.status(404).json({
        errors: [{ message: 'Medicine not found' }]
      });
    }

    res.json({ data: medicine });
  } catch (error) {
    console.error('Get medicine error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// POST create new medicine
router.post('/medicines', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const {
      medicineName,
      genericName,
      category,
      manufacturer,
      batchNumber,
      expiryDate,
      unitPrice,
      stockQuantity,
      reorderLevel,
      dosageForm,
      strength,
      unit,
      storageLocation,
      description,
      requiresPrescription
    } = req.body;

    // Generate unique item code for medicine
    const itemCode = `MED${Date.now()}`;

    const medicine = await prisma.inventoryItem.create({
      data: {
        orgId,
        itemCode,
        itemName: medicineName,
        category: category || 'medicine',
        subcategory: genericName,
        manufacturer,
        batchNumber,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        sellingPrice: unitPrice,
        purchasePrice: unitPrice, // Set purchase price same as selling price if not provided
        quantity: stockQuantity || 0,
        reorderLevel: reorderLevel || 10,
        unit,
        location: storageLocation
      }
    });

    res.status(201).json({ data: medicine });
  } catch (error) {
    console.error('Create medicine error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// PATCH update medicine
router.patch('/medicines/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { id } = req.params;

    // Verify medicine belongs to org
    const existingMedicine = await prisma.inventoryItem.findFirst({
      where: { id, ...(orgId && { orgId }) }
    });

    if (!existingMedicine) {
      return res.status(404).json({
        errors: [{ message: 'Medicine not found' }]
      });
    }

    const updateData = { ...req.body };
    if (updateData.expiryDate) {
      updateData.expiryDate = new Date(updateData.expiryDate);
    }

    const medicine = await prisma.inventoryItem.update({
      where: { id },
      data: updateData
    });

    res.json({ data: medicine });
  } catch (error) {
    console.error('Update medicine error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// DELETE medicine
router.delete('/medicines/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { id } = req.params;

    // Verify medicine belongs to org
    const existingMedicine = await prisma.inventoryItem.findFirst({
      where: { id, ...(orgId && { orgId }) }
    });

    if (!existingMedicine) {
      return res.status(404).json({
        errors: [{ message: 'Medicine not found' }]
      });
    }

    await prisma.inventoryItem.delete({
      where: { id }
    });

    res.json({ message: 'Medicine deleted successfully' });
  } catch (error) {
    console.error('Delete medicine error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// POST adjust stock (add or remove)
router.post('/medicines/:id/stock', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { id } = req.params;
    const { quantity, type, reason, notes } = req.body;

    // type: 'add' or 'remove'
    if (!['add', 'remove'].includes(type)) {
      return res.status(400).json({
        errors: [{ message: 'Type must be either "add" or "remove"' }]
      });
    }

    // Verify medicine belongs to org
    const medicine = await prisma.inventoryItem.findFirst({
      where: { id, ...(orgId && { orgId }) }
    });

    if (!medicine) {
      return res.status(404).json({
        errors: [{ message: 'Medicine not found' }]
      });
    }

    const adjustedQuantity = type === 'add'
      ? medicine.quantity + quantity
      : medicine.quantity - quantity;

    if (adjustedQuantity < 0) {
      return res.status(400).json({
        errors: [{ message: 'Insufficient stock quantity' }]
      });
    }

    const updatedMedicine = await prisma.inventoryItem.update({
      where: { id },
      data: {
        quantity: adjustedQuantity,
        dateUpdated: new Date()
      }
    });

    res.json({
      data: updatedMedicine,
      message: `Stock ${type === 'add' ? 'added' : 'removed'} successfully`
    });
  } catch (error) {
    console.error('Adjust stock error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// ============== PRESCRIPTION API ==============

// GET all prescriptions
router.get('/prescriptions', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { patientId, doctorId, status, page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (orgId) where.orgId = orgId;
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;

    const [prescriptions, total] = await Promise.all([
      prisma.prescription.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          patient: {
            select: { id: true, name: true, patientCode: true }
          },
          prescriptionItems: {
            include: {
              medicine: {
                select: { id: true, itemName: true, subcategory: true, sellingPrice: true }
              }
            }
          }
        },
        orderBy: { prescriptionDate: 'desc' }
      }),
      prisma.prescription.count({ where })
    ]);

    res.json({
      data: prescriptions,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get prescriptions error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// GET single prescription by ID
router.get('/prescriptions/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { id } = req.params;

    const prescription = await prisma.prescription.findFirst({
      where: {
        id,
        ...(orgId && { orgId })
      },
      include: {
        patient: {
          select: { id: true, name: true, patientCode: true }
        },
        prescriptionItems: {
          include: {
            medicine: true
          }
        },
        pharmacyOrders: true
      }
    });

    if (!prescription) {
      return res.status(404).json({
        errors: [{ message: 'Prescription not found' }]
      });
    }

    res.json({ data: prescription });
  } catch (error) {
    console.error('Get prescription error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// POST create new prescription
router.post('/prescriptions', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const {
      patientId,
      doctorId,
      prescriptionDate,
      diagnosis,
      items = [],
      notes
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        errors: [{ message: 'Patient ID is required' }]
      });
    }

    if (!doctorId) {
      return res.status(400).json({
        errors: [{ message: 'Doctor ID is required' }]
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        errors: [{ message: 'At least one medicine is required' }]
      });
    }

    // Generate prescription number
    const prescriptionNumber = await generatePrescriptionNumber(orgId);

    // Calculate total amount and validate medicines exist
    let totalAmount = 0;
    for (const item of items) {
      if (!item.medicineId) {
        return res.status(400).json({
          errors: [{ message: 'Medicine ID is required for all items' }]
        });
      }

      const medicine = await prisma.inventoryItem.findUnique({
        where: { id: item.medicineId }
      });

      if (!medicine) {
        return res.status(404).json({
          errors: [{ message: `Medicine with ID ${item.medicineId} not found` }]
        });
      }

      if (medicine.sellingPrice) {
        totalAmount += Number(medicine.sellingPrice) * item.quantity;
      }
    }

    const prescription = await prisma.prescription.create({
      data: {
        orgId,
        patientId,
        doctorId,
        prescriptionNumber,
        prescriptionDate: prescriptionDate ? new Date(prescriptionDate) : new Date(),
        diagnosis,
        totalAmount,
        status: 'pending',
        notes,
        prescriptionItems: {
          create: items.map(item => ({
            medicineId: item.medicineId,
            quantity: item.quantity,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            instructions: item.instructions
          }))
        }
      },
      include: {
        patient: {
          select: { id: true, name: true, patientCode: true }
        },
        prescriptionItems: {
          include: {
            medicine: true
          }
        }
      }
    });

    res.status(201).json({ data: prescription });
  } catch (error) {
    console.error('Create prescription error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// PATCH update prescription
router.patch('/prescriptions/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { id } = req.params;

    // Verify prescription belongs to org
    const existingPrescription = await prisma.prescription.findFirst({
      where: { id, ...(orgId && { orgId }) }
    });

    if (!existingPrescription) {
      return res.status(404).json({
        errors: [{ message: 'Prescription not found' }]
      });
    }

    const updateData = { ...req.body };
    if (updateData.prescriptionDate) {
      updateData.prescriptionDate = new Date(updateData.prescriptionDate);
    }

    const prescription = await prisma.prescription.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          select: { id: true, name: true, patientCode: true }
        },
        prescriptionItems: {
          include: {
            medicine: true
          }
        }
      }
    });

    res.json({ data: prescription });
  } catch (error) {
    console.error('Update prescription error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// POST cancel prescription
router.post('/prescriptions/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { id } = req.params;
    const { cancelReason } = req.body;

    // Verify prescription belongs to org
    const existingPrescription = await prisma.prescription.findFirst({
      where: { id, ...(orgId && { orgId }) }
    });

    if (!existingPrescription) {
      return res.status(404).json({
        errors: [{ message: 'Prescription not found' }]
      });
    }

    if (existingPrescription.status === 'fulfilled') {
      return res.status(400).json({
        errors: [{ message: 'Cannot cancel fulfilled prescription' }]
      });
    }

    const prescription = await prisma.prescription.update({
      where: { id },
      data: {
        status: 'cancelled',
        notes: cancelReason || existingPrescription.notes
      },
      include: {
        patient: {
          select: { id: true, name: true, patientCode: true }
        },
        prescriptionItems: {
          include: {
            medicine: true
          }
        }
      }
    });

    res.json({ data: prescription });
  } catch (error) {
    console.error('Cancel prescription error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// ============== PHARMACY ORDERS API ==============

// GET all pharmacy orders
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { prescriptionId, status, page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (orgId) where.orgId = orgId;
    if (prescriptionId) where.prescriptionId = prescriptionId;
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.pharmacyOrder.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          prescription: {
            include: {
              patient: {
                select: { id: true, name: true, patientCode: true }
              },
              prescriptionItems: {
                include: {
                  medicine: true
                }
              }
            }
          }
        },
        orderBy: { orderDate: 'desc' }
      }),
      prisma.pharmacyOrder.count({ where })
    ]);

    res.json({
      data: orders,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// GET single pharmacy order by ID
router.get('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { id } = req.params;

    const order = await prisma.pharmacyOrder.findFirst({
      where: {
        id,
        ...(orgId && { orgId })
      },
      include: {
        prescription: {
          include: {
            patient: {
              select: { id: true, name: true, patientCode: true }
            },
            prescriptionItems: {
              include: {
                medicine: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        errors: [{ message: 'Pharmacy order not found' }]
      });
    }

    res.json({ data: order });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// POST create pharmacy order from prescription
router.post('/orders', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { prescriptionId, dispensedBy, notes } = req.body;

    // Verify prescription exists and belongs to org
    const prescription = await prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        ...(orgId && { orgId })
      },
      include: {
        prescriptionItems: {
          include: {
            medicine: true
          }
        },
        patient: {
          select: { id: true, name: true, patientCode: true }
        }
      }
    });

    if (!prescription) {
      return res.status(404).json({
        errors: [{ message: 'Prescription not found' }]
      });
    }

    if (prescription.status === 'fulfilled') {
      return res.status(400).json({
        errors: [{ message: 'Prescription already fulfilled' }]
      });
    }

    // Check stock availability for all items
    for (const item of prescription.prescriptionItems) {
      if (item.medicine.quantity < item.quantity) {
        return res.status(400).json({
          errors: [{
            message: `Insufficient stock for ${item.medicine.itemName}. Available: ${item.medicine.quantity}, Required: ${item.quantity}`
          }]
        });
      }
    }

    // Generate order number
    const orderNumber = await generatePharmacyOrderNumber(orgId);

    // Create order and update stock in transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create pharmacy order
      const newOrder = await tx.pharmacyOrder.create({
        data: {
          orgId,
          prescriptionId,
          orderNumber,
          orderDate: new Date(),
          dispensedBy,
          totalAmount: prescription.totalAmount,
          status: 'fulfilled',
          notes
        },
        include: {
          prescription: {
            include: {
              patient: {
                select: { id: true, name: true, patientCode: true }
              },
              prescriptionItems: {
                include: {
                  medicine: true
                }
              }
            }
          }
        }
      });

      // Update prescription status
      await tx.prescription.update({
        where: { id: prescriptionId },
        data: { status: 'fulfilled' }
      });

      // Deduct stock for each medicine
      for (const item of prescription.prescriptionItems) {
        await tx.inventoryItem.update({
          where: { id: item.medicineId },
          data: {
            quantity: {
              decrement: item.quantity
            }
          }
        });
      }

      return newOrder;
    });

    res.status(201).json({ data: order });
  } catch (error) {
    console.error('Create pharmacy order error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// PATCH update pharmacy order
router.patch('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { id } = req.params;

    // Verify order belongs to org
    const existingOrder = await prisma.pharmacyOrder.findFirst({
      where: { id, ...(orgId && { orgId }) }
    });

    if (!existingOrder) {
      return res.status(404).json({
        errors: [{ message: 'Pharmacy order not found' }]
      });
    }

    const order = await prisma.pharmacyOrder.update({
      where: { id },
      data: req.body,
      include: {
        prescription: {
          include: {
            patient: {
              select: { id: true, name: true, patientCode: true }
            },
            prescriptionItems: {
              include: {
                medicine: true
              }
            }
          }
        }
      }
    });

    res.json({ data: order });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// ============== PHARMACY STATISTICS ==============

// GET pharmacy statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = orgId ? { orgId } : {};

    const [
      totalMedicines,
      lowStockMedicines,
      totalPrescriptions,
      pendingPrescriptions,
      totalOrders,
      totalRevenue,
      categoryBreakdown
    ] = await Promise.all([
      // Total medicines
      prisma.inventoryItem.count({ where }),

      // Low stock medicines (at or below reorder level)
      // Using raw query since Prisma doesn't support field-to-field comparison
      prisma.$queryRaw`
        SELECT COUNT(*)::int as count
        FROM inventory
        WHERE quantity <= reorder_level
        ${orgId ? Prisma.sql`AND org_id = ${orgId}::uuid` : Prisma.empty}
      `.then(result => result[0]?.count || 0),

      // Total prescriptions
      prisma.prescription.count({ where }),

      // Pending prescriptions
      prisma.prescription.count({
        where: { ...where, status: 'pending' }
      }),

      // Total pharmacy orders
      prisma.pharmacyOrder.count({ where }),

      // Total revenue
      prisma.pharmacyOrder.aggregate({
        where: { ...where, status: 'fulfilled' },
        _sum: { totalAmount: true }
      }),

      // Medicines by category
      prisma.inventoryItem.groupBy({
        by: ['category'],
        where,
        _count: { id: true },
        _sum: { quantity: true }
      })
    ]);

    res.json({
      data: {
        inventory: {
          totalMedicines,
          lowStockMedicines,
          categoryBreakdown: categoryBreakdown.map(c => ({
            category: c.category,
            count: c._count.id,
            totalStock: c._sum.quantity || 0
          }))
        },
        prescriptions: {
          total: totalPrescriptions,
          pending: pendingPrescriptions,
          fulfilled: totalPrescriptions - pendingPrescriptions
        },
        orders: {
          total: totalOrders
        },
        revenue: {
          total: totalRevenue._sum.totalAmount || 0
        }
      }
    });
  } catch (error) {
    console.error('Get pharmacy stats error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// GET low stock medicines alert
router.get('/alerts/low-stock', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = orgId ? { orgId } : {};

    // Fetch all medicines and filter in JS since Prisma doesn't support field-to-field comparison
    const allMedicines = await prisma.inventoryItem.findMany({
      where,
      orderBy: { quantity: 'asc' }
    });

    const lowStockMedicines = allMedicines.filter(item => item.quantity <= item.reorderLevel);

    res.json({
      data: lowStockMedicines,
      count: lowStockMedicines.length
    });
  } catch (error) {
    console.error('Get low stock alerts error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// GET expired medicines alert
router.get('/alerts/expired', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = orgId ? { orgId } : {};

    const expiredMedicines = await prisma.inventoryItem.findMany({
      where: {
        ...where,
        expiryDate: {
          lte: new Date()
        }
      },
      orderBy: { expiryDate: 'asc' }
    });

    res.json({
      data: expiredMedicines,
      count: expiredMedicines.length
    });
  } catch (error) {
    console.error('Get expired medicines error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

module.exports = router;
