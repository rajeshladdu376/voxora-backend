require("dotenv").config();

const express = require("express");
const cors = require("cors");

const leadsRouter = require("./routes/leads");
const clientsRouter = require("./routes/clients");
const statsRouter = require("./routes/stats");
const authRouter = require("./routes/auth");
const webhookRoutes = require("./routes/webhook");
const adminRouter = require("./routes/adminRoutes");

const {
  notFound,
  errorHandler,
} = require("./middleware/errorHandler");

const app = express();

const PORT = process.env.PORT || 5001;

// =====================================================
// CORS
// =====================================================

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests without Origin
    // such as curl / server-to-server requests
    if (!origin) {
      return callback(null, true);
    }

    // Local development
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Netlify
    if (
      /^https:\/\/.*\.netlify\.app$/.test(origin)
    ) {
      return callback(null, true);
    }

    // Vercel
    if (
      /^https:\/\/.*\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }

    return callback(
      new Error("Not allowed by CORS")
    );
  },

  methods: [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Range",
  ],

  exposedHeaders: [
    "Content-Length",
    "Content-Range",
    "Accept-Ranges",
    "Content-Type",
    "Content-Disposition",
  ],

  credentials: true,
};

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Voxora CRM API is running",
    version: "1.0.0",

    endpoints: {
      clients: "/api/clients",
      leads: "/api/leads",
      stats: "/api/stats",
      auth: "/api/auth",
      webhook: "/api/webhook",

      recording:
        "/api/recording/proxy?url=RECORDING_URL",

      download:
        "/api/recording/download?url=RECORDING_URL",
    },
  });
});

// =====================================================
// RECORDING HELPERS
// =====================================================

function isValidRecordingUrl(url) {
  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    );
  } catch (error) {
    return false;
  }
}

function getFileExtension(contentType) {
  if (!contentType) {
    return "wav";
  }

  const type =
    contentType.toLowerCase();

  if (type.includes("mpeg")) {
    return "mp3";
  }

  if (type.includes("mp3")) {
    return "mp3";
  }

  if (type.includes("wav")) {
    return "wav";
  }

  if (type.includes("ogg")) {
    return "ogg";
  }

  if (type.includes("webm")) {
    return "webm";
  }

  if (type.includes("mp4")) {
    return "mp4";
  }

  if (type.includes("aac")) {
    return "aac";
  }

  return "wav";
}

// =====================================================
// RECORDING PROXY
//
// IMPORTANT:
//
// This route forwards Range headers.
//
// That is what allows:
// 00:00 -> 00:30 -> 01:00
//
// without restarting the audio.
//
// Browser:
//     React Audio
//          ↓
// /api/recording/proxy
//          ↓
// OmniDimension recording server
// =====================================================

app.get(
  "/api/recording/proxy",
  async (req, res) => {
    try {
      const recordingUrl =
        req.query.url;

      if (!recordingUrl) {
        return res.status(400).json({
          success: false,
          message:
            "Recording URL is required.",
        });
      }

      if (
        !isValidRecordingUrl(
          recordingUrl
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid recording URL.",
        });
      }

      // -------------------------------------------------
      // Forward browser Range request
      // -------------------------------------------------

      const requestHeaders = {};

      if (req.headers.range) {
        requestHeaders.Range =
          req.headers.range;
      }

      // -------------------------------------------------
      // Fetch actual recording
      // -------------------------------------------------

      const upstreamResponse =
        await fetch(
          recordingUrl,
          {
            method: "GET",
            headers: requestHeaders,
            redirect: "follow",
          }
        );

      if (!upstreamResponse.ok) {
        console.error(
          "Recording server error:",
          upstreamResponse.status,
          upstreamResponse.statusText
        );

        return res.status(
          upstreamResponse.status
        ).json({
          success: false,
          message:
            "Unable to retrieve recording.",
          upstreamStatus:
            upstreamResponse.status,
        });
      }

      // -------------------------------------------------
      // Get important headers
      // -------------------------------------------------

      const contentType =
        upstreamResponse.headers.get(
          "content-type"
        ) ||
        "audio/wav";

      const contentLength =
        upstreamResponse.headers.get(
          "content-length"
        );

      const contentRange =
        upstreamResponse.headers.get(
          "content-range"
        );

      const acceptRanges =
        upstreamResponse.headers.get(
          "accept-ranges"
        );

      // -------------------------------------------------
      // Set response headers
      // -------------------------------------------------

      res.setHeader(
        "Content-Type",
        contentType
      );

      res.setHeader(
        "Accept-Ranges",
        acceptRanges || "bytes"
      );

      res.setHeader(
        "Cache-Control",
        "no-cache"
      );

      res.setHeader(
        "Access-Control-Expose-Headers",
        "Content-Length, Content-Range, Accept-Ranges, Content-Type, Content-Disposition"
      );

      if (contentLength) {
        res.setHeader(
          "Content-Length",
          contentLength
        );
      }

      if (contentRange) {
        res.setHeader(
          "Content-Range",
          contentRange
        );
      }

      // -------------------------------------------------
      // Correct HTTP status
      //
      // 206 = Partial Content
      // 200 = Complete Content
      // -------------------------------------------------

      if (
        upstreamResponse.status === 206
      ) {
        res.status(206);
      } else {
        res.status(200);
      }

      // -------------------------------------------------
      // Stream response
      // -------------------------------------------------

      if (!upstreamResponse.body) {
        return res.status(500).json({
          success: false,
          message:
            "Recording response has no body.",
        });
      }

      const reader =
        upstreamResponse.body.getReader();

      try {
        while (true) {
          const {
            done,
            value,
          } = await reader.read();

          if (done) {
            break;
          }

          if (value) {
            res.write(
              Buffer.from(value)
            );
          }
        }
      } finally {
        reader.releaseLock();
      }

      res.end();
    } catch (error) {
      console.error(
        "RECORDING PROXY ERROR:",
        error
      );

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message:
            "Unable to proxy recording.",
          error:
            process.env.NODE_ENV ===
            "development"
              ? error.message
              : undefined,
        });
      }

      res.end();
    }
  }
);

// =====================================================
// RECORDING DOWNLOAD
//
// This downloads the REAL recording bytes.
//
// Browser:
//     Download button
//          ↓
// /api/recording/download
//          ↓
// Actual recording
//          ↓
// attachment download
// =====================================================

app.get(
  "/api/recording/download",
  async (req, res) => {
    try {
      const recordingUrl =
        req.query.url;

      const requestedName =
        req.query.name ||
        "voxora-call-recording";

      if (!recordingUrl) {
        return res.status(400).json({
          success: false,
          message:
            "Recording URL is required.",
        });
      }

      if (
        !isValidRecordingUrl(
          recordingUrl
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid recording URL.",
        });
      }

      // -------------------------------------------------
      // Fetch ORIGINAL recording
      //
      // Do NOT forward Range here.
      // Download must fetch the complete file.
      // -------------------------------------------------

      const upstreamResponse =
        await fetch(
          recordingUrl,
          {
            method: "GET",
            redirect: "follow",
          }
        );

      if (!upstreamResponse.ok) {
        console.error(
          "Download upstream error:",
          upstreamResponse.status
        );

        return res.status(
          upstreamResponse.status
        ).json({
          success: false,
          message:
            "Unable to download recording.",
        });
      }

      const contentType =
        upstreamResponse.headers.get(
          "content-type"
        ) ||
        "audio/wav";

      const contentLength =
        upstreamResponse.headers.get(
          "content-length"
        );

      const extension =
        getFileExtension(
          contentType
        );

      // -------------------------------------------------
      // Clean filename
      // -------------------------------------------------

      const safeName =
        String(requestedName)
          .replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
          )
          .replace(
            /_+/g,
            "_"
          );

      const filename =
        `${safeName}.${extension}`;

      // -------------------------------------------------
      // Download headers
      // -------------------------------------------------

      res.setHeader(
        "Content-Type",
        contentType
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      res.setHeader(
        "Cache-Control",
        "no-store"
      );

      res.setHeader(
        "Access-Control-Expose-Headers",
        "Content-Disposition, Content-Length, Content-Type"
      );

      if (contentLength) {
        res.setHeader(
          "Content-Length",
          contentLength
        );
      }

      // -------------------------------------------------
      // Stream actual audio file
      // -------------------------------------------------

      if (!upstreamResponse.body) {
        return res.status(500).json({
          success: false,
          message:
            "Recording response has no body.",
        });
      }

      const reader =
        upstreamResponse.body.getReader();

      try {
        while (true) {
          const {
            done,
            value,
          } = await reader.read();

          if (done) {
            break;
          }

          if (value) {
            res.write(
              Buffer.from(value)
            );
          }
        }
      } finally {
        reader.releaseLock();
      }

      res.end();
    } catch (error) {
      console.error(
        "RECORDING DOWNLOAD ERROR:",
        error
      );

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message:
            "Unable to download recording.",
          error:
            process.env.NODE_ENV ===
            "development"
              ? error.message
              : undefined,
        });
      }

      res.end();
    }
  }
);

// =====================================================
// EXISTING API ROUTES
// =====================================================

app.use(
  "/api/clients",
  clientsRouter
);

app.use(
  "/api/leads",
  leadsRouter
);

app.use(
  "/api/stats",
  statsRouter
);

app.use(
  "/api/auth",
  authRouter
);

app.use(
  "/api/admin",
  adminRouter
);

app.use(
  "/api/webhook",
  webhookRoutes
);

app.use(
  "/api/post-call",
  webhookRoutes
);
// =====================================================
// ERROR HANDLING
// =====================================================

app.use(notFound);

app.use(errorHandler);

// =====================================================
// SERVER
// =====================================================

app.listen(
  PORT,
  () => {
    console.log(
      `\n🚀 Voxora CRM Backend running on http://localhost:${PORT}`
    );

    console.log(
      `📊 Environment: ${
        process.env.NODE_ENV ||
        "development"
      }`
    );

    console.log(
      `\nAPI Endpoints:`
    );

    console.log(
      `  GET  /api/clients`
    );

    console.log(
      `  POST /api/clients`
    );

    console.log(
      `  GET  /api/leads`
    );

    console.log(
      `  POST /api/leads`
    );

    console.log(
      `  GET  /api/stats`
    );

    console.log(
      `  GET  /api/recording/proxy`
    );

    console.log(
      `  GET  /api/recording/download`
    );

    console.log("");
  }
);

module.exports = app;