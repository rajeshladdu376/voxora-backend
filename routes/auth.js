const express = require("express");
const router = express.Router();

const {
  loginClient,
} = require("../controllers/authController");

const {
  loginAdmin,
} = require("../controllers/adminController");

// =====================================================
// AUTH ROUTE TEST
// =====================================================

router.get("/", (req, res) => {
  res.json({
    message: "Auth route is working",
  });
});

// =====================================================
// CLIENT LOGIN
// =====================================================

router.post("/login", loginClient);

// =====================================================
// ADMIN LOGIN
// =====================================================

router.post("/admin/login", loginAdmin);

module.exports = router;