const supabase = require("../config/supabase");

async function getStats(req, res, next) {
  try {
    // =====================================================
    // CLIENT
    // =====================================================

    const clientId = req.client.id;

    // =====================================================
    // RANGE
    // =====================================================

    const range =
      req.query.range === "30D"
        ? "30D"
        : "7D";

    const days =
      range === "30D"
        ? 30
        : 7;

    console.log("=================================");
    console.log("STATS RANGE:", range);
    console.log("JWT CLIENT ID:", clientId);

    // =====================================================
    // GET CLIENT LEADS
    // =====================================================

    const { data: leads, error } =
      await supabase
        .from("leads")
        .select("*")
        .eq("client_id", clientId);

    if (error) {
      throw error;
    }

    const allLeads = Array.isArray(leads)
      ? leads
      : [];

    console.log(
      "TOTAL LEADS FROM DB:",
      allLeads.length
    );

    // =====================================================
    // CURRENT TIME
    // =====================================================

    const now = new Date();

    // =====================================================
    // IST DATE HELPER
    // =====================================================

    const getISTDate = (date) => {
      if (!date) {
        return null;
      }

      return new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }
      ).format(new Date(date));
    };

    // =====================================================
    // STATUS HELPER
    // =====================================================

    const getLeadStatus = (lead) => {
      const rawStatus =
        lead.status ??
        lead.lead_status ??
        lead.leadStatus ??
        "";

      return String(rawStatus)
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
    };

    // =====================================================
    // RANGE START
    // =====================================================

    const rangeStart = new Date(now);

    rangeStart.setHours(
      0,
      0,
      0,
      0
    );

    rangeStart.setDate(
      rangeStart.getDate() -
        (days - 1)
    );

    // =====================================================
    // FILTER LEADS FOR RANGE
    // =====================================================

    const targetLeads =
      allLeads.filter((lead) => {
        if (!lead.created_at) {
          return false;
        }

        const createdAt =
          new Date(
            lead.created_at
          );

        return (
          createdAt >= rangeStart &&
          createdAt <= now
        );
      });

    console.log(
      "TARGET LEADS:",
      targetLeads.length
    );

    // =====================================================
    // TODAY IN IST
    // =====================================================

    const todayIST =
      getISTDate(now);

    console.log(
      "TODAY IST:",
      todayIST
    );

    // =====================================================
    // TODAY'S INTERESTED / QUALIFIED
    // =====================================================

    const todaysInterestedQualified =
      allLeads.filter((lead) => {
        if (!lead.created_at) {
          return false;
        }

        const createdDateIST =
          getISTDate(
            lead.created_at
          );

        const status =
          getLeadStatus(lead);

        const isToday =
          createdDateIST ===
          todayIST;

        const isInterested =
          status === "interested";

        const isQualified =
          status === "qualified";

        // DEBUG
        console.log(
          "TODAY LEAD CHECK:",
          {
            id: lead.id,
            customer:
              lead.customer_name ??
              lead.customerName ??
              "Unknown",
            created_at:
              lead.created_at,
            createdDateIST,
            status,
            isToday,
            isInterested,
            isQualified,
          }
        );

        return (
          isToday &&
          (
            isInterested ||
            isQualified
          )
        );
      }).length;

    console.log(
      "TODAY'S INTERESTED / QUALIFIED:",
      todaysInterestedQualified
    );

    // =====================================================
    // DAILY TIMELINE
    // =====================================================

    const timelineLabels = [];
    const timelineValues = [];

    for (
      let i = 0;
      i < days;
      i++
    ) {
      const day =
        new Date(rangeStart);

      day.setDate(
        rangeStart.getDate() + i
      );

      const nextDay =
        new Date(day);

      nextDay.setDate(
        day.getDate() + 1
      );

      const count =
        targetLeads.filter(
          (lead) => {
            if (!lead.created_at) {
              return false;
            }

            const createdAt =
              new Date(
                lead.created_at
              );

            return (
              createdAt >= day &&
              createdAt < nextDay
            );
          }
        ).length;

      timelineLabels.push(
        day.toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
          }
        )
      );

      timelineValues.push(
        count
      );
    }

    // =====================================================
    // START OF TODAY
    // =====================================================

    const startOfToday =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

    // =====================================================
    // START OF WEEK
    // =====================================================

    const startOfWeek =
      new Date(
        startOfToday
      );

    startOfWeek.setDate(
      startOfToday.getDate() -
        startOfToday.getDay()
    );

    // =====================================================
    // START OF MONTH
    // =====================================================

    const startOfMonth =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );

    // =====================================================
    // TODAY / WEEK / MONTH
    // =====================================================

    const todaysLeads =
      allLeads.filter(
        (lead) => {
          if (!lead.created_at) {
            return false;
          }

          return (
            new Date(
              lead.created_at
            ) >= startOfToday
          );
        }
      ).length;

    const thisWeeksLeads =
      allLeads.filter(
        (lead) => {
          if (!lead.created_at) {
            return false;
          }

          return (
            new Date(
              lead.created_at
            ) >= startOfWeek
          );
        }
      ).length;

    const thisMonthsLeads =
      allLeads.filter(
        (lead) => {
          if (!lead.created_at) {
            return false;
          }

          return (
            new Date(
              lead.created_at
            ) >= startOfMonth
          );
        }
      ).length;

    // =====================================================
    // TOTAL
    // =====================================================

    const total =
      targetLeads.length;

    // =====================================================
    // STATUS BREAKDOWN
    // =====================================================

    const byStatus = {};

    for (
      const lead of targetLeads
    ) {
      const status =
        getLeadStatus(lead) ||
        "new";

      byStatus[status] =
        (
          byStatus[status] || 0
        ) + 1;
    }

    // =====================================================
    // CALL DURATION
    // =====================================================

    const totalCallDuration =
      targetLeads.reduce(
        (sum, lead) => {
          return (
            sum +
            (
              Number(
                lead.call_duration
              ) || 0
            )
          );
        },
        0
      );

    const avgCallDuration =
      total > 0
        ? Math.round(
            totalCallDuration /
              total
          )
        : 0;

    // =====================================================
    // LANGUAGE BREAKDOWN
    // =====================================================

    const languageBreakdown = {};

    for (
      const lead of targetLeads
    ) {
      const language =
        lead.language ||
        "unknown";

      languageBreakdown[
        language
      ] =
        (
          languageBreakdown[
            language
          ] || 0
        ) + 1;
    }

    // =====================================================
    // PACKAGE BREAKDOWN
    // =====================================================

    const packageBreakdown = {};

    for (
      const lead of targetLeads
    ) {
      const pkg =
        lead.package ??
        lead.selected_package ??
        "unspecified";

      packageBreakdown[pkg] =
        (
          packageBreakdown[pkg] || 0
        ) + 1;
    }

    // =====================================================
    // SENTIMENT BREAKDOWN
    // =====================================================

    const sentimentBreakdown = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    for (
      const lead of targetLeads
    ) {
      const rawSentiment =
        lead.sentiment ??
        lead.ai_sentiment ??
        lead.call_sentiment ??
        "";

      const sentiment =
        String(rawSentiment)
          .trim()
          .toLowerCase();

      if (
        sentiment === "positive" ||
        sentiment ===
          "positive_sentiment"
      ) {
        sentimentBreakdown.positive += 1;
      } else if (
        sentiment === "negative" ||
        sentiment ===
          "negative_sentiment"
      ) {
        sentimentBreakdown.negative += 1;
      } else {
        sentimentBreakdown.neutral += 1;
      }
    }

    // =====================================================
    // CONVERSION RATE
    // =====================================================

    const conversionRate =
      total > 0
        ? parseFloat(
            (
              (
                (
                  byStatus.converted ||
                  0
                ) /
                total
              ) *
              100
            ).toFixed(2)
          )
        : 0;

    // =====================================================
    // RESPONSE
    // =====================================================

    res.json({
      success: true,

      data: {
        // =================================================
        // OVERVIEW
        // =================================================

        overview: {
          totalLeads:
            total,

          todaysInterestedQualified:
            todaysInterestedQualified,

          conversionRate:
            `${conversionRate}%`,

          avgCallDurationSeconds:
            avgCallDuration,
        },

        // =================================================
        // STATUS
        // =================================================

        byStatus: {
          new:
            byStatus.new || 0,

          interested:
            byStatus.interested || 0,

          notInterested:
            byStatus.not_interested || 0,

          callback:
            byStatus.callback || 0,

          qualified:
            byStatus.qualified || 0,

          converted:
            byStatus.converted || 0,

          doNotCall:
            byStatus.do_not_call || 0,
        },

        // =================================================
        // TIMELINE
        // =================================================

        timeline: {
          labels:
            timelineLabels,

          values:
            timelineValues,

          today:
            todaysLeads,

          thisWeek:
            thisWeeksLeads,

          thisMonth:
            thisMonthsLeads,
        },

        // =================================================
        // BREAKDOWN
        // =================================================

        breakdown: {
          byLanguage:
            languageBreakdown,

          byPackage:
            packageBreakdown,

          sentiment:
            sentimentBreakdown,
        },

        // =================================================
        // META
        // =================================================

        range,

        generatedAt:
          new Date().toISOString(),

        filteredByClient:
          clientId,
      },
    });

    // =====================================================
    // FINAL DEBUG
    // =====================================================

    console.log(
      "TIMELINE LABELS:",
      timelineLabels
    );

    console.log(
      "TIMELINE VALUES:",
      timelineValues
    );

    console.log(
      "TODAY'S INTERESTED / QUALIFIED:",
      todaysInterestedQualified
    );

    console.log(
      "SENTIMENT:",
      sentimentBreakdown
    );

    console.log(
      "================================="
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStats,
};