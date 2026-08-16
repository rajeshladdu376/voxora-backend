# Voxora CRM Backend

Production-ready CRM backend for the Voxora AI Voice Agent Agency. Built with Node.js + Express using a flat JSON file database. Designed for OmniDimension AI Agents to push leads automatically via REST API.

---

## Quick Start

```bash
npm install
npm start
```

Server runs at `http://localhost:5000`

For development with auto-reload:

```bash
npm run dev
```

---

## Folder Structure

```
voxora-backend/
├── server.js                  # Entry point
├── package.json
├── .env
├── config/
│   └── db.js                  # JSON file read/write helpers
├── routes/
│   ├── leads.js
│   ├── clients.js
│   └── stats.js
├── controllers/
│   ├── leadsController.js
│   ├── clientsController.js
│   └── statsController.js
├── middleware/
│   ├── errorHandler.js
│   └── validate.js
├── models/
│   ├── Lead.js
│   └── Client.js
└── data/
    ├── leads.json             # Auto-created on first run
    └── clients.json           # Auto-created on first run
```

---

## Environment Variables

```env
PORT=5000
NODE_ENV=development
```

---

## API Endpoints

### Clients

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | Get all clients (supports `?search=`, `?page=`, `?limit=`) |
| GET | `/api/clients/:id` | Get a single client by ID |
| POST | `/api/clients` | Create a new client |
| PUT | `/api/clients/:id` | Update a client |
| DELETE | `/api/clients/:id` | Delete a client |

**POST /api/clients body:**
```json
{
  "companyName": "Acme Corp",
  "website": "https://acme.com",
  "email": "contact@acme.com",
  "phone": "+1234567890"
}
```

---

### Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | Get all leads (supports filters below) |
| GET | `/api/leads/:id` | Get a single lead by ID |
| GET | `/api/leads/client/:clientId` | Get all leads for a specific client |
| POST | `/api/leads` | Create a new lead (OmniDimension endpoint) |
| PUT | `/api/leads/:id` | Update a lead |
| DELETE | `/api/leads/:id` | Delete a lead |

**GET /api/leads query parameters:**
- `clientId` — filter by client
- `status` — filter by status (comma-separated for multiple: `interested,callback`)
- `search` — search across name, business, phone, email, summary
- `sort` — `newest` (default) or `oldest`
- `page` — page number (default: 1)
- `limit` — results per page (default: 20, max: 100)

**Lead status values:**
`new` | `interested` | `not_interested` | `callback` | `qualified` | `converted` | `do_not_call`

---

### Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Global stats across all leads |
| GET | `/api/stats?clientId=xxx` | Stats filtered to one client |

**Response includes:**
- Total leads, total clients, conversion rate
- Breakdown by status (interested, not interested, etc.)
- Timeline: today, this week, this month
- Breakdown by language and package
- Average call duration

---

## OmniDimension Integration

Configure OmniDimension to POST to:

```
POST https://your-domain.com/api/leads
Content-Type: application/json
```

**Payload:**
```json
{
  "clientId": "uuid-of-your-client",
  "customerName": "Jane Smith",
  "businessName": "Smith Bakery",
  "phone": "+15551234567",
  "email": "jane@smithbakery.com",
  "package": "starter",
  "status": "interested",
  "summary": "Customer expressed interest in the starter plan. Requested a follow-up call.",
  "callDuration": 142,
  "language": "en"
}
```

The `clientId` must match an existing client in the system. Create the client first via `POST /api/clients`.

**Response on success:**
```json
{
  "success": true,
  "data": {
    "leadId": "generated-uuid",
    "clientId": "...",
    ...
  }
}
```

---

## CORS

Allowed origins:
- `http://localhost:3000`
- `http://localhost:5173`
- `https://*.netlify.app`
- `https://*.vercel.app`

---

## Error Responses

All errors follow this shape:

```json
{
  "success": false,
  "error": {
    "message": "Description of the error",
    "status": 400
  }
}
```

HTTP status codes used: `400` (validation), `404` (not found), `409` (conflict/duplicate), `500` (server error).
