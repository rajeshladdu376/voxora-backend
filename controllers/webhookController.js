const supabase = require("../config/supabase");

// =====================================================
// OMNIDIMENSION API KEY
// =====================================================

const OMNIDIM_API_KEY = process.env.OMNIDIM_API_KEY;

// =====================================================
// WAIT HELPER
// =====================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =====================================================
// MEANINGFUL VALUE CHECK
// =====================================================

function isMeaningfulValue(value) {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  if (typeof value === "string") {
    return value.trim() !== "";
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return true;
}

// =====================================================
// VALUE TO TEXT
// =====================================================

function valueToText(value) {
  if (!isMeaningfulValue(value)) {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => valueToText(item))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value)
      .map(([key, val]) => {
        const text = valueToText(val);

        if (!text) {
          return "";
        }

        return `${key}: ${text}`;
      })
      .filter(Boolean)
      .join(" • ");
  }

  return String(value).trim();
}

// =====================================================
// PHONE NUMBER HELPERS
// =====================================================

const PHONE_KEYS = [
  "phone_number",
  "phoneNumber",
  "customer_phone_number",
  "customerPhoneNumber",
  "caller_phone_number",
  "callerPhoneNumber",
  "caller_number",
  "callerNumber",
  "from_number",
  "fromNumber",
  "to_number",
  "toNumber",
  "contact_number",
  "contactNumber",
  "mobile_number",
  "mobileNumber",
  "mobile",
  "phone",
];

const IGNORED_PHONE_VALUES = [
  "chat",
  "email",
  "web",
  "website",
  "unknown",
  "null",
  "undefined",
  "n/a",
  "na",
  "none",
];

function normalizePhone(value) {
  if (value === undefined || value === null) {
    return "";
  }

  const text = String(value).trim();

  if (!text) {
    return "";
  }

  if (IGNORED_PHONE_VALUES.includes(text.toLowerCase())) {
    return "";
  }

  const digits = text.replace(/\D/g, "");

  if (digits.length < 7) {
    return "";
  }

  return text;
}

function findPhoneNumber(body) {
  if (!body) {
    return "";
  }

  function search(value) {
    if (!value) {
      return "";
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = search(item);

        if (found) {
          return found;
        }
      }

      return "";
    }

    if (typeof value === "object" && value !== null) {
      for (const key of PHONE_KEYS) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const candidate = normalizePhone(value[key]);

          if (candidate) {
            return candidate;
          }
        }
      }

      for (const nestedValue of Object.values(value)) {
        if (
          nestedValue &&
          typeof nestedValue === "object"
        ) {
          const found = search(nestedValue);

          if (found) {
            return found;
          }
        }
      }
    }

    return "";
  }

  return search(body);
}

// =====================================================
// RECORDING URL
// =====================================================

function findRecordingUrl(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value === "string" &&
    /^https?:\/\//i.test(value)
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecordingUrl(item);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const preferredKeys = [
      "recording_url",
      "recordingUrl",
      "internal_recording_url",
      "internalRecordingUrl",
      "audio_url",
      "audioUrl",
      "recording",
      "audio",
    ];

    for (const key of preferredKeys) {
      const candidate = value[key];

      if (
        typeof candidate === "string" &&
        /^https?:\/\//i.test(candidate)
      ) {
        return candidate;
      }
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      if (preferredKeys.includes(key)) {
        continue;
      }

      const found = findRecordingUrl(nestedValue);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

// =====================================================
// CALL ID
// =====================================================

function findCallId(body) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const directCallId =
    body.call_id ||
    body.callId ||
    body.call_log_id ||
    body.callLogId;

  if (isMeaningfulValue(directCallId)) {
    return String(directCallId).trim();
  }

  const possibleObjects = [
    body.call_report,
    body.callReport,
    body.call_log_data,
    body.callLogData,
    body.call,
    body.data,
  ];

  for (const object of possibleObjects) {
    if (!object || typeof object !== "object") {
      continue;
    }

    const nestedId =
      object.call_id ||
      object.callId ||
      object.call_log_id ||
      object.callLogId ||
      object.id;

    if (isMeaningfulValue(nestedId)) {
      return String(nestedId).trim();
    }
  }

  const keys = [
    "call_id",
    "callId",
    "call_log_id",
    "callLogId",
  ];

  function recursiveSearch(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = recursiveSearch(item);

        if (found) {
          return found;
        }
      }

      return null;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      if (
        keys.includes(key) &&
        isMeaningfulValue(nestedValue)
      ) {
        return String(nestedValue).trim();
      }

      if (
        nestedValue &&
        typeof nestedValue === "object"
      ) {
        const found = recursiveSearch(nestedValue);

        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  return recursiveSearch(body);
}

// =====================================================
// FIND CALL RECORD BY ID
// =====================================================

function findCallRecordById(result, callId) {
  if (
    !result ||
    !Array.isArray(result.call_log_data)
  ) {
    return null;
  }

  const normalizedCallId = String(callId).trim();

  for (const record of result.call_log_data) {
    if (!record) {
      continue;
    }

    const recordId =
      record.id ||
      record.call_id ||
      record.callId;

    if (
      recordId !== undefined &&
      String(recordId).trim() === normalizedCallId
    ) {
      return record;
    }
  }

  return null;
}

// =====================================================
// DURATION HELPERS
// =====================================================

function normalizeDuration(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value === "number") {
    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      return null;
    }

    return Math.round(value);
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  let match = text.match(
    /^(\d+):(\d{2}):(\d{2})$/
  );

  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);

    return (
      hours * 3600 +
      minutes * 60 +
      seconds
    );
  }

  match = text.match(
    /^(\d+):(\d{2})$/
  );

  if (match) {
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);

    return minutes * 60 + seconds;
  }

  match = text.match(
    /(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/i
  );

  if (match) {
    return Math.round(Number(match[1]));
  }

  const numeric = Number(text);

  if (
    Number.isFinite(numeric) &&
    numeric >= 0
  ) {
    return Math.round(numeric);
  }

  return null;
}

function findCallDuration(value) {
  if (!value) {
    return null;
  }

  const preferredKeys = [
    "call_duration",
    "callDuration",
    "duration",
    "duration_seconds",
    "durationSeconds",
    "call_duration_seconds",
    "callDurationSeconds",
    "talk_time",
    "talkTime",
    "total_duration",
    "totalDuration",
  ];

  if (
    typeof value === "object" &&
    value !== null
  ) {
    for (const key of preferredKeys) {
      if (
        Object.prototype.hasOwnProperty.call(
          value,
          key
        )
      ) {
        const duration =
          normalizeDuration(value[key]);

        if (duration !== null) {
          return duration;
        }
      }
    }

    for (const nestedValue of Object.values(value)) {
      if (
        nestedValue &&
        typeof nestedValue === "object"
      ) {
        const duration =
          findCallDuration(nestedValue);

        if (duration !== null) {
          return duration;
        }
      }
    }
  }

  return null;
}

// =====================================================
// FETCH SINGLE CALL LOG
// =====================================================

async function fetchSingleCallLog(callId) {
  if (!OMNIDIM_API_KEY) {
    console.error(
      "[OmniDimension] OMNIDIM_API_KEY is missing"
    );

    return null;
  }

  try {
    console.log(
      `[OmniDimension] Fetching call log ${callId}`
    );

    const response = await fetch(
      `https://backend.omnidim.io/api/v1/calls/logs/${encodeURIComponent(
        callId
      )}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${OMNIDIM_API_KEY}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      console.warn(
        `[OmniDimension] Single call-log HTTP ${response.status}`
      );

      const text = await response.text();

      console.warn(
        "[OmniDimension] Response:",
        text
      );

      return null;
    }

    const result = await response.json();

    console.log(
      "[OmniDimension] Single call-log response:"
    );

    console.log(
      JSON.stringify(result, null, 2)
    );

    return result;
  } catch (error) {
    console.error(
      "[OmniDimension] Single call-log request failed:",
      error.message
    );

    return null;
  }
}

// =====================================================
// FETCH CALL LOG LIST
// =====================================================

async function fetchCallLogList(callId) {
  if (!OMNIDIM_API_KEY) {
    return null;
  }

  try {
    console.log(
      `[OmniDimension] Falling back to call-log list for ${callId}`
    );

    const response = await fetch(
      "https://backend.omnidim.io/api/v1/calls/logs?pageno=1&pagesize=150",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${OMNIDIM_API_KEY}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      console.warn(
        `[OmniDimension] Call-log list HTTP ${response.status}`
      );

      const text = await response.text();

      console.warn(
        "[OmniDimension] List response:",
        text
      );

      return null;
    }

    const result = await response.json();

    console.log(
      `[OmniDimension] Call-log list returned ${
        Array.isArray(result.call_log_data)
          ? result.call_log_data.length
          : 0
      } records`
    );

    const record =
      findCallRecordById(
        result,
        callId
      );

    if (!record) {
      console.log(
        `[OmniDimension] Call ${callId} was not found in call-log list`
      );

      return null;
    }

    console.log(
      "[OmniDimension] Matching call record found:"
    );

    console.log(
      JSON.stringify(record, null, 2)
    );

    return record;
  } catch (error) {
    console.error(
      "[OmniDimension] Call-log list request failed:",
      error.message
    );

    return null;
  }
}

// =====================================================
// FETCH BEST CALL RECORD
// =====================================================

async function fetchBestCallRecord(callId) {
  if (!callId) {
    return null;
  }

  const singleResult =
    await fetchSingleCallLog(callId);

  if (singleResult) {
    if (
      singleResult.id ||
      singleResult.call_id ||
      singleResult.callId
    ) {
      return singleResult;
    }

    const exactRecord =
      findCallRecordById(
        singleResult,
        callId
      );

    if (exactRecord) {
      return exactRecord;
    }

    if (
      findPhoneNumber(singleResult) ||
      findRecordingUrl(singleResult) ||
      findCallDuration(singleResult)
    ) {
      return singleResult;
    }
  }

  const listRecord =
    await fetchCallLogList(callId);

  return listRecord;
}

// =====================================================
// FETCH RECORDING + DURATION + PHONE WITH RETRY
// =====================================================

async function fetchCallDetailsWithRetry(
  callId,
  maxAttempts = 6,
  delayMs = 5000
) {
  if (!callId) {
    console.log(
      "[Call Details] No call ID available"
    );

    return {
      phone: "",
      duration: null,
      recordingUrl: null,
    };
  }

  if (!OMNIDIM_API_KEY) {
    console.error(
      "[Call Details] OMNIDIM_API_KEY is missing"
    );

    return {
      phone: "",
      duration: null,
      recordingUrl: null,
    };
  }

  console.log(
    `[Call Details] Starting lookup for call ${callId}`
  );

  let bestPhone = "";
  let bestDuration = null;
  let bestRecordingUrl = null;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    await sleep(delayMs);

    try {
      console.log(
        `[Call Details] Attempt ${attempt}/${maxAttempts}`
      );

      const record =
        await fetchBestCallRecord(callId);

      if (!record) {
        console.log(
          "[Call Details] Call record not available yet"
        );

        continue;
      }

      const phone =
        findPhoneNumber(record);

      if (phone) {
        bestPhone = phone;

        console.log(
          "📱 CALL LOG PHONE:",
          phone
        );
      }

      const duration =
        findCallDuration(record);

      if (duration !== null) {
        bestDuration = duration;

        console.log(
          "⏱️ CALL LOG DURATION:",
          `${duration}s`
        );
      }

      const recordingUrl =
        findRecordingUrl(record);

      if (recordingUrl) {
        bestRecordingUrl =
          recordingUrl;

        console.log(
          "🎙️ RECORDING URL FOUND:",
          recordingUrl
        );
      }

      if (bestRecordingUrl) {
        console.log(
          "================================="
        );

        console.log(
          "✅ COMPLETE CALL DETAILS FOUND"
        );

        console.log(
          "Call ID:",
          callId
        );

        console.log(
          "Phone:",
          bestPhone || "NOT FOUND"
        );

        console.log(
          "Duration:",
          bestDuration !== null
            ? `${bestDuration}s`
            : "NOT FOUND"
        );

        console.log(
          "Recording:",
          bestRecordingUrl
        );

        console.log(
          "================================="
        );

        return {
          phone: bestPhone,
          duration: bestDuration,
          recordingUrl: bestRecordingUrl,
        };
      }

      console.log(
        "[Call Details] Call exists, but recording is not ready yet"
      );
    } catch (error) {
      console.error(
        `[Call Details] Attempt ${attempt} failed:`,
        error.message
      );
    }
  }

  console.warn(
    `[Call Details] Finished retries for call ${callId}`
  );

  return {
    phone: bestPhone,
    duration: bestDuration,
    recordingUrl: bestRecordingUrl,
  };
}

// =====================================================
// UNIVERSAL CUSTOM DATA BUILDER
// =====================================================

function buildUniversalCustomData(body) {
  const source =
    body &&
    typeof body === "object"
      ? body
      : {};

  const customData = {
    ...source,
  };

  let extractedVariables = null;

  function findExtractedVariables(value) {
    if (
      !value ||
      typeof value !== "object"
    ) {
      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found =
          findExtractedVariables(item);

        if (found) {
          return found;
        }
      }

      return null;
    }

    const directKeys = [
      "extracted_variables",
      "extractedVariables",
    ];

    for (const key of directKeys) {
      if (
        value[key] &&
        typeof value[key] === "object" &&
        !Array.isArray(value[key])
      ) {
        return value[key];
      }
    }

    for (const nestedValue of Object.values(value)) {
      if (
        nestedValue &&
        typeof nestedValue === "object"
      ) {
        const found =
          findExtractedVariables(
            nestedValue
          );

        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  extractedVariables =
    findExtractedVariables(source);

  if (
    extractedVariables &&
    typeof extractedVariables === "object" &&
    !Array.isArray(extractedVariables)
  ) {
    customData.extracted_variables = {
      ...extractedVariables,
    };

    Object.entries(
      extractedVariables
    ).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        customData[key] = value;
      }
    });
  }

  return customData;
}

// =====================================================
// UNIVERSAL BOOKING FIELD GROUPS
// =====================================================

const BOOKING_FIELD_GROUPS = {
  person: [
    "doctor",
    "doctor_name",
    "doctorName",

    "selected_doctor",
    "selectedDoctor",

    "physician",
    "physician_name",
    "physicianName",

    "dentist",
    "dentist_name",
    "dentistName",

    "trainer",
    "trainer_name",
    "trainerName",

    "stylist",
    "stylist_name",
    "stylistName",

    "staff",
    "staff_name",
    "staffName",

    "consultant",
    "consultant_name",
    "consultantName",

    "professional",
    "professional_name",
    "professionalName",

    "specialist",
    "specialist_name",
    "specialistName",

    "assigned_to",
    "assignedTo",

    "expert",
    "expert_name",
    "expertName",

    "therapist",
    "therapist_name",
    "therapistName",
  ],

  date: [
    "date",

    "booking_date",
    "bookingDate",

    "appointment_date",
    "appointmentDate",

    "appointment_day",
    "appointmentDay",

    "scheduled_date",
    "scheduledDate",

    "session_date",
    "sessionDate",

    "visit_date",
    "visitDate",

    "consultation_date",
    "consultationDate",
  ],

  time: [
    "time",

    "booking_time",
    "bookingTime",

    "appointment_time",
    "appointmentTime",

    "scheduled_time",
    "scheduledTime",

    "session_time",
    "sessionTime",

    "visit_time",
    "visitTime",

    "consultation_time",
    "consultationTime",
  ],

  service: [
    "service",
    "service_type",
    "serviceType",

    "appointment_type",
    "appointmentType",

    "session",
    "session_type",
    "sessionType",

    "treatment",
    "treatment_type",
    "treatmentType",

    "consultation",
    "consultation_type",
    "consultationType",

    "procedure",
    "procedure_type",
    "procedureType",

    "booking_type",
    "bookingType",

    "visit_type",
    "visitType",
  ],
};

// =====================================================
// FIND VALUE BY KEYS
// =====================================================

function findValueByKeys(source, keys) {
  if (
    !source ||
    typeof source !== "object"
  ) {
    return "";
  }

  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(
        source,
        key
      )
    ) {
      const value = source[key];

      if (isMeaningfulValue(value)) {
        return valueToText(value);
      }
    }
  }

  return "";
}

// =====================================================
// FIND VALUE RECURSIVELY BY KEYS
// =====================================================

function findValueByKeysRecursive(
  source,
  keys
) {
  if (
    !source ||
    typeof source !== "object"
  ) {
    return "";
  }

  const directValue =
    findValueByKeys(
      source,
      keys
    );

  if (directValue) {
    return directValue;
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const found =
        findValueByKeysRecursive(
          item,
          keys
        );

      if (found) {
        return found;
      }
    }

    return "";
  }

  for (const nestedValue of Object.values(source)) {
    if (
      nestedValue &&
      typeof nestedValue === "object"
    ) {
      const found =
        findValueByKeysRecursive(
          nestedValue,
          keys
        );

      if (found) {
        return found;
      }
    }
  }

  return "";
}

// =====================================================
// EXTRACT BUDGET FROM TEXT
// =====================================================

function extractBudgetFromText(text) {
  if (!text) {
    return "";
  }

  const source = String(text).trim();

  if (!source) {
    return "";
  }

  // ===================================================
  // COMMON BUDGET PATTERNS
  // ===================================================

  const patterns = [
    // ₹2 crore / ₹2 crores / ₹2 cr
    /₹\s*\d+(?:\.\d+)?\s*(?:crores?|cr)\b/i,

    // 2 crore / 2 crores / 2 cr
    /\b\d+(?:\.\d+)?\s*(?:crores?|cr)\b/i,

    // 2 lakh / 2 lakhs / 2 lac / 2 lacs
    /₹?\s*\d+(?:\.\d+)?\s*(?:lakhs?|lacs?)\b/i,

    // ₹2,00,00,000 / 2,00,00,000
    /₹?\s*\d{1,3}(?:,\d{2}){2,3}\b/,

    // ₹20000000
    /₹\s*\d{5,}\b/,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);

    if (match && match[0]) {
      return match[0].trim();
    }
  }

  return "";
}

// =====================================================
// EXTRACT UNIVERSAL BOOKING DATA
// =====================================================

function extractUniversalBookingData(
  customData
) {
  const extracted =
    customData?.extracted_variables;

  const source =
    extracted &&
    typeof extracted === "object"
      ? extracted
      : customData;

  if (
    !source ||
    typeof source !== "object"
  ) {
    return null;
  }

  const person =
    findValueByKeysRecursive(
      source,
      BOOKING_FIELD_GROUPS.person
    );

  const date =
    findValueByKeysRecursive(
      source,
      BOOKING_FIELD_GROUPS.date
    );

  const time =
    findValueByKeysRecursive(
      source,
      BOOKING_FIELD_GROUPS.time
    );

  const service =
    findValueByKeysRecursive(
      source,
      BOOKING_FIELD_GROUPS.service
    );

  if (
    !person &&
    !date &&
    !time &&
    !service
  ) {
    return null;
  }

  const booking = {};

  if (person) {
    booking.person = person;
  }

  if (date) {
    booking.date = date;
  }

  if (time) {
    booking.time = time;
  }

  if (service) {
    booking.service = service;
  }

  return booking;
}

// =====================================================
// BUILD BOOKING DISPLAY TEXT
// =====================================================

function buildBookingDisplayText(
  booking
) {
  if (
    !booking ||
    typeof booking !== "object"
  ) {
    return "";
  }

  const parts = [];

  if (booking.person) {
    parts.push(booking.person);
  }

  if (
    booking.date &&
    booking.time
  ) {
    parts.push(
      `${booking.date} — ${booking.time}`
    );
  } else if (booking.date) {
    parts.push(booking.date);
  } else if (booking.time) {
    parts.push(booking.time);
  }

  if (booking.service) {
    parts.push(booking.service);
  }

  return parts.join(" — ");
}

// =====================================================
// FIND MEANINGFUL CUSTOM VALUE
// =====================================================

function findMeaningfulCustomValue(
  body,
  customData,
  bookingData = null
) {
  // ===================================================
  // 1. BOOKING DISPLAY FIRST
  // ===================================================

  const bookingDisplay =
    buildBookingDisplayText(bookingData);

  if (bookingDisplay) {
    return bookingDisplay;
  }

  // ===================================================
  // 2. FIND PROPERTY / PACKAGE
  // ===================================================

  const propertyKeys = [
    "propertyType",
    "property_type",
    "property",
    "package",
    "package_name",
    "packageName",
    "selected_package",
    "selectedPackage",
  ];

  const requirementKeys = [
    "requirement",
    "requirements",
  ];

  // ===================================================
  // 3. FIND PROPERTY TYPE
  // ===================================================

  const propertyType =
    findValueByKeysRecursive(
      body,
      propertyKeys
    ) ||
    findValueByKeysRecursive(
      customData,
      propertyKeys
    );

  // ===================================================
  // 4. FIND REQUIREMENT
  // ===================================================

  const requirement =
    findValueByKeysRecursive(
      body,
      requirementKeys
    ) ||
    findValueByKeysRecursive(
      customData,
      requirementKeys
    );

  // ===================================================
  // 5. COMBINE PROPERTY + REQUIREMENT
  // ===================================================

  if (propertyType && requirement) {
    return `${propertyType} - ${requirement}`;
  }

  // ===================================================
  // 6. PROPERTY ONLY
  // ===================================================

  if (propertyType) {
    return propertyType;
  }

  // ===================================================
  // 7. REQUIREMENT ONLY
  // ===================================================

  if (requirement) {
    return requirement;
  }

  // ===================================================
  // 8. OTHER EXTRACTED VARIABLES
  // ===================================================

  const extractedVariables =
    customData?.extracted_variables;

  if (
    extractedVariables &&
    typeof extractedVariables === "object"
  ) {
    const preferredKeys = [
      "service",
      "service_type",
      "serviceType",

      "product",
      "product_name",
      "productName",

      "plan",
      "plan_name",
      "planName",

      "program",
      "program_name",
      "programName",

      "course",
      "course_name",
      "courseName",

      "coaching_type",
      "coachingType",

      "membership",
      "subscription",

      "interest",
      "interested_in",
      "interestedIn",

      "selection",
      "selected_option",
      "selectedOption",

      "type",
      "category",
      "item",

      "booking",
      "booking_type",
      "bookingType",
    ];

    for (const key of preferredKeys) {
      const value =
        extractedVariables[key];

      if (isMeaningfulValue(value)) {
        return valueToText(value);
      }
    }

    const ignored = [
      "customer_name",
      "customerName",

      "phone",
      "phone_number",
      "phoneNumber",

      "email",

      "lead_status",
      "leadStatus",

      "call_summary",
      "callSummary",

      "preferred_language",
      "preferredLanguage",

      "language",

      "doctor",
      "doctor_name",
      "doctorName",

      "selected_doctor",
      "selectedDoctor",

      "appointment_date",
      "appointmentDate",

      "appointment_day",
      "appointmentDay",

      "appointment_time",
      "appointmentTime",

      "booking_date",
      "bookingDate",

      "booking_time",
      "bookingTime",

      "scheduled_date",
      "scheduledDate",

      "scheduled_time",
      "scheduledTime",

      "session_date",
      "sessionDate",

      "session_time",
      "sessionTime",

      "visit_date",
      "visitDate",

      "visit_time",
      "visitTime",

      "consultation_date",
      "consultationDate",

      "consultation_time",
      "consultationTime",

      "service",
      "service_type",
      "serviceType",

      "propertyType",
      "property_type",
      "property",

      "requirement",
      "requirements",
    ];

    for (const [key, value] of Object.entries(
      extractedVariables
    )) {
      if (!isMeaningfulValue(value)) {
        continue;
      }

      if (ignored.includes(key)) {
        continue;
      }

      return valueToText(value);
    }
  }

  // ===================================================
  // 10. FALLBACK THROUGH CUSTOM DATA
  // ===================================================

  const ignoredKeys = new Set([
    "id",
    "clientId",
    "client_id",

    "customerName",
    "customer_name",

    "phone",
    "phone_number",
    "phoneNumber",

    "email",

    "status",
    "lead_status",

    "summary",
    "call_summary",

    "language",
    "preferred_language",

    "callDuration",
    "call_duration",
    "duration",

    "transcript",

    "callId",
    "call_id",

    "recording_url",
    "recordingUrl",

    "extracted_variables",
    "extractedVariables",

    "call_report",
    "callReport",

    "call_log_data",
    "callLogData",

    "booking",

    "propertyType",
    "property_type",
    "property",

    "requirement",
    "requirements",
  ]);

  for (const [key, value] of Object.entries(
    customData || {}
  )) {
    if (
      ignoredKeys.has(key) ||
      !isMeaningfulValue(value)
    ) {
      continue;
    }

    const text = valueToText(value);

    if (text) {
      return text;
    }
  }

  return "";
}

// =====================================================
// OMNIDIMENSION WEBHOOK
// =====================================================

async function omniWebhook(req, res) {
  try {
    console.log(
      "\n===== OMNIDIMENSION WEBHOOK ====="
    );

    console.log(
      JSON.stringify(
        req.body,
        null,
        2
      )
    );

    console.log(
      "================================\n"
    );

    const body = req.body || {};

    // =================================================
    // CALL ID
    // =================================================

    const callId =
      findCallId(body);

    console.log(
      "📞 Call ID:",
      callId || "NOT RECEIVED"
    );

    // =================================================
    // BASIC LEAD DATA
    // =================================================

    const customerName =
      body.customer_name ||
      body.customerName ||
      body.user_name ||
      body.userName ||
      "";

    const businessName =
      body.business_name ||
      body.businessName ||
      "";

    // =================================================
    // PHONE
    // =================================================

    let phone =
      findPhoneNumber(body);

    console.log(
      "📱 Phone from webhook:",
      phone || "NOT FOUND"
    );

    // =================================================
    // EMAIL
    // =================================================

    const email =
      body.email ||
      body.user_email ||
      body.userEmail ||
      "";

    // =================================================
    // STATUS
    // =================================================

    const rawLeadStatus =
      body.lead_status ||
      body.leadStatus ||
      body.status ||
      body.call_status ||
      "new";

    const statusMap = {
      new: "new",
      interested: "interested",
      "not interested": "not_interested",
      not_interested: "not_interested",
      callback: "callback",
      qualified: "qualified",
      converted: "converted",
      "do not call": "do_not_call",
      do_not_call: "do_not_call",
    };

    const leadStatus =
      statusMap[
        String(rawLeadStatus)
          .trim()
          .toLowerCase()
      ] || "new";

    // =================================================
    // CALL SUMMARY
    // =================================================

    const callSummary =
      body.call_summary ||
      body.callSummary ||
      body.summary ||
      body.call_report?.summary ||
      "";

    // =================================================
    // WEBHOOK DURATION
    // =================================================

    const webhookDuration =
      findCallDuration(body);

    console.log(
      "⏱️ Duration from webhook:",
      webhookDuration !== null
        ? `${webhookDuration}s`
        : "NOT FOUND"
    );

    // =================================================
    // LANGUAGE
    // =================================================

    const language =
      body.language ||
      body.preferred_language ||
      body.preferredLanguage ||
      "en";

    // =================================================
    // CLIENT ID
    // =================================================

    const clientId =
      body.client_id ||
      body.clientId ||
      null;

    console.log(
      "👤 Client ID:",
      clientId || "NOT FOUND"
    );

    // =================================================
    // DIRECT RECORDING
    // =================================================

    const webhookRecordingUrl =
      findRecordingUrl(body);

    console.log(
      "🎙️ Recording from webhook:",
      webhookRecordingUrl ||
        "NOT READY"
    );

    // =================================================
    // TRANSCRIPT
    // =================================================

    const callTranscript =
      body.transcript ||
      body.call_transcript ||
      body.callTranscript ||
      body.call_conversation ||
      body.callConversation ||
      body.call_report?.full_conversation ||
      "";

    // =================================================
    // CUSTOM DATA
    // =================================================

    const customData =
      buildUniversalCustomData(body);

    // =================================================
    // UNIVERSAL BOOKING DATA
    // =================================================

    const bookingData =
      extractUniversalBookingData(
        customData
      );

    if (bookingData) {
      customData.booking =
        bookingData;

      console.log(
        "\n===== BOOKING DATA DETECTED ====="
      );

      console.log(
        JSON.stringify(
          bookingData,
          null,
          2
        )
      );

      console.log(
        "BOOKING DISPLAY:",
        buildBookingDisplayText(
          bookingData
        )
      );

      console.log(
        "=================================\n"
      );
    } else {
      console.log(
        "📅 No booking/appointment data detected"
      );
    }

    // =================================================
    // PACKAGE / MEANINGFUL CUSTOM VALUE
    // =================================================

    const packageName =
      findMeaningfulCustomValue(
        body,
        customData,
        bookingData
      );

   // =================================================
// PROPERTY PRICE / BUDGET
// =================================================

// Look inside extracted_variables first
const extractedVars = customData?.extracted_variables || {};

const directBudget =
  extractedVars.property_price ||
  extractedVars.propertyPrice ||
  extractedVars.budget ||
  extractedVars.budget_range ||
  extractedVars.budgetRange ||

  body.propertyPrice ||
  body.property_price ||
  body.budget ||
  body.budget_range ||
  body.budgetRange ||

  findValueByKeysRecursive(body, [
    "propertyPrice",
    "property_price",
    "budget",
    "budget_range",
    "budgetRange",
  ]) ||

  findValueByKeysRecursive(customData, [
    "propertyPrice",
    "property_price",
    "budget",
    "budget_range",
    "budgetRange",
  ]) ||

  "";

// =================================================
// FALLBACK: EXTRACT BUDGET FROM AI SUMMARY
// =================================================

const budgetFromSummary = extractBudgetFromText(callSummary);

// =================================================
// FALLBACK: EXTRACT BUDGET FROM TRANSCRIPT
// =================================================

const budgetFromTranscript = extractBudgetFromText(callTranscript);

// =================================================
// FINAL BUDGET
// =================================================

const budget =
  valueToText(directBudget) ||
  budgetFromSummary ||
  budgetFromTranscript ||
  "";

console.log("💰 Extracted Variables:", extractedVars);

console.log(
  "💰 Direct Budget:",
  valueToText(directBudget) || "NOT FOUND"
);

console.log(
  "💰 Budget from Summary:",
  budgetFromSummary || "NOT FOUND"
);

console.log(
  "💰 Budget from Transcript:",
  budgetFromTranscript || "NOT FOUND"
);

console.log(
  "💰 FINAL BUDGET:",
  budget || "NOT FOUND"
);

console.log(
  "📦 Package display value:",
  packageName || "NOT FOUND"
);

    // =================================================
    // INITIAL DATABASE VALUES
    // =================================================

    const newLead = {
      customer_name:
        customerName,

      business_name:
        businessName,

      phone:
        phone || "",

      email,

      package:
        packageName || null,

      // BUDGET FIX
      budget:
        budget || null,

      status:
        leadStatus,

      summary:
        callSummary,

      call_duration:
        webhookDuration !== null
          ? webhookDuration
          : 0,

      language,

      client_id:
        clientId,

      call_id:
        callId,

      recording_url:
        webhookRecordingUrl || null,

      transcript:
        callTranscript || null,

      custom_data:
        customData,
    };

    // =================================================
    // DEBUG
    // =================================================

    console.log(
      "\n===== INITIAL LEAD DATA ====="
    );

    console.log(
      "Customer:",
      customerName
    );

    console.log(
      "Business:",
      businessName
    );

    console.log(
      "Phone:",
      phone || "NOT FOUND"
    );

    console.log(
      "Email:",
      email
    );

    console.log(
      "Package:",
      packageName || "—"
    );

    console.log(
      "Budget:",
      budget || "—"
    );

    console.log(
      "Status:",
      leadStatus
    );

    console.log(
      "Webhook Duration:",
      webhookDuration !== null
        ? `${webhookDuration}s`
        : "NOT FOUND"
    );

    console.log(
      "Language:",
      language
    );

    console.log(
      "Recording:",
      webhookRecordingUrl ||
        "NOT READY"
    );

    console.log(
      "Transcript:",
      callTranscript
        ? "RECEIVED"
        : "NOT RECEIVED"
    );

    console.log(
      "Booking:",
      bookingData
        ? JSON.stringify(
            bookingData
          )
        : "NO BOOKING DATA"
    );

    console.log(
      "================================\n"
    );

    // =================================================
    // DUPLICATE CHECK / UPSERT LOGIC
    // =================================================

    let existingLead = null;

    if (clientId && phone && email) {
      const duplicateWindow =
        new Date(
          Date.now() - 10 * 60 * 1000
        ).toISOString();

      const {
        data: recentLead,
        error: duplicateCheckError,
      } = await supabase
        .from("leads")
        .select("*")
        .eq("client_id", clientId)
        .eq("phone", phone)
        .eq("email", email)
        .gte("created_at", duplicateWindow)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (duplicateCheckError) {
        console.error(
          "Duplicate check error:",
          duplicateCheckError
        );
      } else {
        existingLead = recentLead;
      }
    }

    // =================================================
    // UPDATE EXISTING LEAD
    // =================================================

    if (existingLead) {
      console.log(
        "\n================================="
      );

      console.log(
        "🔄 DUPLICATE WEBHOOK DETECTED"
      );

      console.log(
        "Existing Lead ID:",
        existingLead.id
      );

      console.log(
        "Existing Status:",
        existingLead.status
      );

      console.log(
        "New Status:",
        leadStatus
      );

      console.log(
        "=================================\n"
      );

      const updateData = {
        customer_name:
          customerName ||
          existingLead.customer_name,

        business_name:
          businessName ||
          existingLead.business_name,

        phone:
          phone ||
          existingLead.phone,

        email:
          email ||
          existingLead.email,

        package:
          packageName ||
          existingLead.package,

        // BUDGET FIX
        budget:
          budget ||
          existingLead.budget ||
          null,

        status:
          leadStatus ||
          existingLead.status,

        summary:
          callSummary ||
          existingLead.summary,

        call_duration:
          webhookDuration !== null
            ? webhookDuration
            : existingLead.call_duration,

        language:
          language ||
          existingLead.language,

        client_id:
          clientId ||
          existingLead.client_id,

        call_id:
          callId ||
          existingLead.call_id,

        recording_url:
          webhookRecordingUrl ||
          existingLead.recording_url,

        transcript:
          callTranscript ||
          existingLead.transcript,

        custom_data:
          customData ||
          existingLead.custom_data,

        updated_at:
          new Date().toISOString(),
      };

      // =================================================
      // BUDGET DEBUG
      // =================================================

      console.log(
        "\n===== DUPLICATE LEAD UPDATE ====="
      );

      console.log(
        "Lead ID:",
        existingLead.id
      );

      console.log(
        "Budget:",
        updateData.budget || "NULL"
      );

      console.log(
        "=================================\n"
      );

      const {
        data,
        error,
      } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", existingLead.id)
        .select()
        .single();

      if (error) {
        console.error(
          "Supabase Update Error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Failed to update existing lead",
          error:
            error.message,
        });
      }

      console.log(
        "✅ Existing lead updated successfully"
      );

      console.log(
        "Lead ID:",
        data.id
      );

      console.log(
        "Updated Status:",
        data.status
      );

      console.log(
        "Updated Budget:",
        data.budget || "NULL"
      );

      console.log(
        "================================\n"
      );

      return res.status(200).json({
        success: true,
        message:
          "Duplicate webhook detected - existing lead updated",
        lead: data,
      });
    }

    // =================================================
    // CREATE NEW LEAD
    // =================================================

    const {
      data,
      error,
    } = await supabase
      .from("leads")
      .insert([
        newLead,
      ])
      .select()
      .single();

    if (error) {
      console.error(
        "Supabase Insert Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to save lead",
        error:
          error.message,
      });
    }

    // =================================================
    // SUCCESS
    // =================================================

    console.log(
      "✅ Lead saved successfully"
    );

    console.log(
      "Lead ID:",
      data.id
    );

    console.log(
      "Saved Budget:",
      data.budget || "NULL"
    );

    console.log(
      "================================\n"
    );

    // =================================================
    // RESPOND IMMEDIATELY
    // =================================================

    res.status(200).json({
      success: true,
      message:
        "Webhook received and lead saved",
      lead: data,
    });

    // =================================================
    // POST-WEBHOOK CALL DETAILS BACKFILL
    // =================================================

    if (callId) {
      console.log(
        `🔄 Starting call-details backfill for ${callId}`
      );

      fetchCallDetailsWithRetry(
        callId
      ).then(
        async ({
          phone: callLogPhone,
          duration: callLogDuration,
          recordingUrl: callLogRecordingUrl,
        }) => {
          try {
            const updateData = {};

            // PHONE
            if (callLogPhone) {
              updateData.phone =
                callLogPhone;
            }

            // DURATION
            if (
              callLogDuration !== null &&
              callLogDuration !== undefined
            ) {
              updateData.call_duration =
                callLogDuration;
            }

            // RECORDING
            if (callLogRecordingUrl) {
              updateData.recording_url =
                callLogRecordingUrl;
            }

            // NOTHING TO UPDATE
            if (
              Object.keys(
                updateData
              ).length === 0
            ) {
              console.warn(
                `⚠️ No additional call details found for ${callId}`
              );

              return;
            }

            // UPDATED AT
            updateData.updated_at =
              new Date().toISOString();

            // UPDATE LEAD
            const {
              data: updatedLead,
              error: updateError,
            } = await supabase
              .from("leads")
              .update(updateData)
              .eq("id", data.id)
              .select()
              .single();

            if (updateError) {
              console.error(
                "❌ Call-details Supabase update error:",
                updateError
              );

              return;
            }

            console.log(
              "\n================================="
            );

            console.log(
              "✅ CALL DETAILS BACKFILLED"
            );

            console.log(
              "Lead ID:",
              data.id
            );

            console.log(
              "Call ID:",
              callId
            );

            console.log(
              "Phone:",
              updatedLead.phone ||
                "NOT FOUND"
            );

            console.log(
              "Duration:",
              updatedLead.call_duration !== null &&
              updatedLead.call_duration !== undefined
                ? `${updatedLead.call_duration}s`
                : "NOT FOUND"
            );

            console.log(
              "Recording:",
              updatedLead.recording_url ||
                "NOT FOUND"
            );

            console.log(
              "=================================\n"
            );
          } catch (error) {
            console.error(
              "[Backfill] Failed:",
              error.message
            );
          }
        }
      );
    } else {
      console.warn(
        "⚠️ NO CALL ID RECEIVED"
      );

      console.warn(
        "Phone/duration/recording cannot be backfilled from the OmniDimension call log."
      );
    }
  } catch (err) {
    console.error(
      "Webhook Error:",
      err
    );

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message:
          "Webhook failed",
        error:
          err.message,
      });
    }
  }
}

// =====================================================
// EXPORT
// =====================================================

module.exports = {
  omniWebhook,
};