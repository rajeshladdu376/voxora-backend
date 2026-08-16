const express = require("express");

const router = express.Router();

const {
  loginAdmin,
  getAdminOverview,
} = require("../controllers/adminController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

// =====================================================
// ADMIN LOGIN
// =====================================================

// POST /api/admin/login
router.post("/login", loginAdmin);

// =====================================================
// ADMIN DASHBOARD
// =====================================================

// GET /api/admin/overview
//
// authMiddleware:
//   verifies JWT and creates req.client
//
// adminMiddleware:
//   checks req.client.role === "admin"
//
router.get(
  "/overview",
  authMiddleware,
  adminMiddleware,
  getAdminOverview
);

module.exports = router;