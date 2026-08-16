const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");

const JWT_SECRET = process.env.JWT_SECRET;

// =====================================================
// ADMIN LOGIN
// =====================================================

async function loginAdmin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required.",
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error(
        "[Admin Login] ADMIN_EMAIL or ADMIN_PASSWORD is missing."
      );

      return res.status(500).json({
        success: false,
        error: "Admin authentication is not configured.",
      });
    }

    const emailMatches =
      email.trim().toLowerCase() ===
      adminEmail.trim().toLowerCase();

    const passwordMatches =
      password === adminPassword;

    if (!emailMatches || !passwordMatches) {
      return res.status(401).json({
        success: false,
        error: "Invalid admin email or password.",
      });
    }
    
    const token = jwt.sign(
      {
        id: "admin",
        email: adminEmail,
        role: "admin",
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    console.log(
      `[Voxora Admin] Admin login successful: ${adminEmail}`
    );

    return res.json({
      success: true,
      message: "Admin login successful",
      token,
    });
  } catch (error) {
    console.error("[Admin Login]", error);

    return res.status(500).json({
      success: false,
      error: "Admin login failed.",
    });
  }
}

// =====================================================
// ADMIN OVERVIEW
//
// GET /api/admin/overview
//
// IMPORTANT:
// This is intentionally separate from the Client CRM
// controllers.
//
// Admin sees ALL clients and ALL leads.
// =====================================================

async function getAdminOverview(req, res) {
  try {
    // =================================================
    // FETCH ALL CLIENTS
    // =================================================

    const {
      data: clients,
      error: clientsError,
    } = await supabase
      .from("clients")
      .select(
        "id, company_name, email, phone, agent_id, display_name, status, created_at"
      )
      .order("created_at", {
        ascending: false,
      });

    if (clientsError) {
      console.error(
        "[Admin Overview] Clients:",
        clientsError.message
      );

      return res.status(500).json({
        success: false,
        error: "Failed to fetch clients.",
      });
    }

    // =================================================
    // FETCH ALL LEADS
    // =================================================

    const {
      data: leads,
      error: leadsError,
    } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (leadsError) {
      console.error(
        "[Admin Overview] Leads:",
        leadsError.message
      );

      return res.status(500).json({
        success: false,
        error: "Failed to fetch leads.",
      });
    }

    const allClients = clients || [];
    const allLeads = leads || [];
    const activeClientIds = new Set(
  allClients.map((client) => String(client.id))
);

const activeLeads = allLeads.filter(
  (lead) =>
    lead.client_id &&
    activeClientIds.has(String(lead.client_id))
);

    // =================================================
    // CLIENT LOOKUP
    // =================================================

    const clientMap = new Map(
      allClients.map((client) => [
        String(client.id),
        client,
      ])
    );

    // =================================================
    // NORMALIZE ALL LEADS
    // =================================================
    //
    // IMPORTANT:
    // We return ALL leads here.
    // We do NOT use slice(0, 10).
    //
    // Business name is taken from the connected client.
    // =================================================

    const allCalls = activeLeads.map((lead) => {
      const client = lead.client_id
        ? clientMap.get(String(lead.client_id))
        : null;

      return {
        id: lead.id,

        client_id:
          lead.client_id || null,

        customer_name:
          lead.customer_name ||
          lead.name ||
          "",

        // REAL CLIENT BUSINESS NAME
        business_name:
          client?.company_name ||
          lead.business_name ||
          "",

        company_name:
          client?.company_name ||
          "",

        phone:
          lead.phone || "",

        email:
          lead.email || "",

        package:
          lead.package ||
          lead.selected_package ||
          lead.selectedPackage ||
          "",

        status:
          lead.status || "new",

        summary:
          lead.summary || "",

        call_duration:
          lead.call_duration || 0,

        language:
          lead.language || "en",

        recording_url:
          lead.recording_url || "",

        transcript:
          lead.transcript || "",

        custom_data:
          lead.custom_data || {},

        created_at:
          lead.created_at || null,

        updated_at:
          lead.updated_at ||
          lead.created_at ||
          null,
      };
    });

    // =================================================
    // DATE HELPERS
    // =================================================

    const now = new Date();

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const startOfWeek = new Date(startOfToday);

    // Monday = first day of week
    const day = startOfWeek.getDay();

    const daysSinceMonday =
      day === 0 ? 6 : day - 1;

    startOfWeek.setDate(
      startOfWeek.getDate() - daysSinceMonday
    );

    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    function getLeadDate(lead) {
      const value =
        lead.created_at ||
        lead.createdAt;

      if (!value) {
        return null;
      }

      const date = new Date(value);

      return Number.isNaN(date.getTime())
        ? null
        : date;
    }

    // =================================================
    // DATE FILTERS
    // =================================================

    const todaysLeads = allCalls.filter((lead) => {
      const date = getLeadDate(lead);

      return date && date >= startOfToday;
    });

    const thisWeeksLeads = allCalls.filter((lead) => {
      const date = getLeadDate(lead);

      return date && date >= startOfWeek;
    });

    const thisMonthsLeads = allCalls.filter((lead) => {
      const date = getLeadDate(lead);

      return date && date >= startOfMonth;
    });

    // =================================================
    // STATUS COUNTS
    // =================================================

    const interestedLeads =
      allCalls.filter((lead) => {
        const status = String(
          lead.status || ""
        ).toLowerCase();

        return (
          status.includes("interested") ||
          status.includes("converted") ||
          status.includes("booked")
        );
      });

    const convertedLeads =
      allCalls.filter((lead) => {
        const status = String(
          lead.status || ""
        ).toLowerCase();

        return (
          status.includes("converted") ||
          status.includes("closed") ||
          status.includes("booked")
        );
      });

    // =================================================
    // RECENT CLIENTS
    // =================================================

    const recentClients =
      allClients.slice(0, 5).map((client) => ({
        id: client.id,

        company_name:
          client.company_name || "",

        display_name:
          client.display_name || "",

        email:
          client.email || "",

        phone:
          client.phone || "",

        agent_id:
          client.agent_id || "",

        status:
          client.status || "",

        created_at:
          client.created_at || null,
      }));

    // =================================================
    // RESPONSE
    // =================================================

    console.log(
      "[Admin Overview] Clients:",
      allClients.length
    );

    console.log(
      "[Admin Overview] ALL leads:",
      allCalls.length
    );

    console.log(
      "[Admin Overview] Today:",
      todaysLeads.length
    );

    console.log(
      "[Admin Overview] This week:",
      thisWeeksLeads.length
    );

    console.log(
      "[Admin Overview] This month:",
      thisMonthsLeads.length
    );

    return res.json({
      success: true,

      stats: {
        totalClients:
          allClients.length,

        totalLeads:
          allCalls.length,

        totalCalls:
          allCalls.length,

        todaysCalls:
          todaysLeads.length,

        todayCalls:
          todaysLeads.length,

        thisWeekCalls:
          thisWeeksLeads.length,

        thisMonthCalls:
          thisMonthsLeads.length,

        interestedLeads:
          interestedLeads.length,

        convertedLeads:
          convertedLeads.length,
      },

      recentClients,

      // Keep this for existing frontend compatibility.
      recentCalls:
        allCalls.slice(0, 10),

      // NEW:
      // Complete dataset for Admin CRM.
      allCalls,
    });
  } catch (error) {
    console.error(
      "[Admin Overview]",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Failed to load admin overview.",
    });
  }
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  loginAdmin,
  getAdminOverview,
};