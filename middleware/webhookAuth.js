const crypto = require("crypto");

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// =====================================================
// WEBHOOK AUTHENTICATION + PAYLOAD VALIDATION
// =====================================================

function webhookAuth(req, res, next) {
  // ===================================================
  // 1. CHECK WEBHOOK SECRET CONFIGURATION
  // ===================================================

  if (!WEBHOOK_SECRET) {
    console.error(
      "❌ WEBHOOK_SECRET is not configured in .env"
    );

    return res.status(500).json({
      success: false,
      message: "Webhook security is not configured.",
    });
  }

  // ===================================================
  // 2. GET SECRET FROM REQUEST
  // ===================================================

 const receivedSecret =
  req.headers["x-webhook-secret"] ||
  req.query.secret;
  if (!receivedSecret) {
    console.warn(
      "⚠️ Webhook request rejected: missing secret"
    );

    return res.status(401).json({
      success: false,
      message: "Webhook authentication required.",
    });
  }

  // ===================================================
  // 3. SAFE SECRET COMPARISON
  // ===================================================

  const expectedBuffer = Buffer.from(
    WEBHOOK_SECRET,
    "utf8"
  );

  const receivedBuffer = Buffer.from(
    String(receivedSecret),
    "utf8"
  );

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    console.warn(
      "⚠️ Webhook request rejected: invalid secret"
    );

    return res.status(401).json({
      success: false,
      message: "Invalid webhook authentication.",
    });
  }

  const isValid = crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );

  if (!isValid) {
    console.warn(
      "⚠️ Webhook request rejected: invalid secret"
    );

    return res.status(401).json({
      success: false,
      message: "Invalid webhook authentication.",
    });
  }

  console.log(
    "🔐 Webhook authentication successful"
  );

  // ===================================================
  // 4. PAYLOAD VALIDATION
  // ===================================================

  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    console.warn(
      "⚠️ Webhook request rejected: invalid payload"
    );

    return res.status(400).json({
      success: false,
      message: "Invalid webhook payload.",
    });
  }

  // ===================================================
  // 5. PREVENT EMPTY PAYLOAD
  // ===================================================

  const bodyKeys = Object.keys(req.body);

  if (bodyKeys.length === 0) {
    console.warn(
      "⚠️ Webhook request rejected: empty payload"
    );

    return res.status(400).json({
      success: false,
      message: "Webhook payload cannot be empty.",
    });
  }

  // ===================================================
  // 6. REQUIRE A CALL IDENTIFIER
  // ===================================================
  //
  // We don't require body.id because OmniDimension
  // may use that for another purpose.
  //
  // We specifically look for call_id / callId and
  // common nested locations.
  // ===================================================

  const hasDirectCallId =
  req.body.call_id ||
  req.body.callId ||
  req.body.call_log_id ||
  req.body.callLogId;

const hasNestedCallId =
  req.body.call_report?.call_id ||
  req.body.call_report?.callId ||
  req.body.callReport?.call_id ||
  req.body.callReport?.callId ||
  req.body.call?.call_id ||
  req.body.call?.callId ||
  req.body.data?.call_id ||
  req.body.data?.callId;

const callId =
  hasDirectCallId ||
  hasNestedCallId;

  // ===================================================
  // 7. VALID WEBHOOK
  // ===================================================

  console.log(
    "✅ Webhook payload validation successful"
  );

  console.log(
    "📞 Validated Call ID:",
    String(callId).trim()
  );

  next();
}

module.exports = webhookAuth;