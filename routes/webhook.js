const express = require("express");
const router = express.Router();

const { omniWebhook } = require("../controllers/webhookController");
const webhookAuth = require("../middleware/webhookAuth");

// =====================================================
// OMNIDIMENSION WEBHOOK
// =====================================================

router.post("/", webhookAuth, omniWebhook);

module.exports = router;