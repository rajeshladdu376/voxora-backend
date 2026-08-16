const supabase = require('../config/supabase');

const {
  validateLead,
  VALID_STATUSES,
} = require('../models/Lead');

// =====================================================
// MAP DATABASE ROW → FRONTEND LEAD
// =====================================================

function mapLead(row) {
  return {
    // =================================================
    // ID
    // =================================================

    leadId: row.id,

    clientId: row.client_id,

    // =================================================
    // BASIC INFORMATION
    // =================================================

    customerName:
      row.customer_name ||
      row.name ||
      '',

    businessName:
      row.business_name ||
      '',

    phone:
      row.phone ||
      '',

    email:
      row.email ||
      '',

    // =================================================
    // PACKAGE
    // =================================================
    //
    // IMPORTANT:
    //
    // The webhook saves the meaningful package value
    // into the Supabase "package" column.
    //
    // This was previously missing from mapLead(),
    // which caused the frontend to receive:
    //
    // package: ""
    //
    // even though Supabase contained:
    //
    // package: "Fitness Coaching"
    //
    // =================================================

    package:
      row.package ||
      row.selected_package ||
      row.selectedPackage ||
      '',
    // =================================================
// BUDGET
// =================================================

budget:
  row.budget ||
  row.property_price ||
  row.propertyPrice ||
  '',
    // =================================================
    // UNIVERSAL CUSTOM DATA
    // =================================================

    customData:
      row.custom_data &&
      typeof row.custom_data === 'object'
        ? row.custom_data
        : {},

    // =================================================
    // LEAD DATA
    // =================================================

    status:
      row.status ||
      'new',

    summary:
      row.summary ||
      '',

    callDuration:
      row.call_duration ||
      0,

    language:
      row.language ||
      'en',

    // =================================================
    // RECORDING
    // =================================================

    recordingUrl:
      row.recording_url ||
      '',

    // =================================================
    // TRANSCRIPT
    // =================================================

    transcript:
      row.transcript ||
      '',

    // =================================================
    // DATE
    // =================================================

    createdAt:
      row.created_at ||
      null,

    updatedAt:
      row.updated_at ||
      row.created_at ||
      null,
  };
}

// =====================================================
// GET ALL LEADS
// =====================================================

function getAllLeads(req, res, next) {
  (async () => {
    try {
      const {
        clientId,
        status,
        search,
        sort = 'newest',
        page = 1,
        limit = 1000000
      } = req.query;

      const {
        data,
        error,
      } = await supabase
        .from('leads')
        .select('*')
        .eq('client_id', req.client.id);

      if (error) {
        throw error;
      }

      let results = data.map(mapLead);

      // =================================================
      // CLIENT FILTER
      // =================================================

      if (clientId) {
        results = results.filter(
          (lead) =>
            lead.clientId === clientId
        );
      }

      // =================================================
      // STATUS FILTER
      // =================================================

      if (status) {
        const statuses = status
          .split(',')
          .map((s) => s.trim());

        results = results.filter(
          (lead) =>
            statuses.includes(
              lead.status
            )
        );
      }

      // =================================================
      // SEARCH
      // SEARCHES BASIC DATA + ALL CUSTOM DATA
      // =================================================

      if (search) {
        const q = search
          .toLowerCase()
          .trim();

        results = results.filter((lead) => {
          const basicText = [
            lead.customerName,
            lead.businessName,
            lead.phone,
            lead.email,
            lead.package,
            lead.status,
            lead.summary,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          const customText = Object.entries(
            lead.customData || {}
          )
            .map(([key, value]) => {
              if (
                value === null ||
                value === undefined
              ) {
                return key;
              }

              if (
                typeof value === 'object'
              ) {
                return `${key} ${JSON.stringify(value)}`;
              }

              return `${key} ${value}`;
            })
            .join(' ')
            .toLowerCase();

          return (
            basicText.includes(q) ||
            customText.includes(q)
          );
        });
      }

      // =================================================
      // SORT
      // =================================================

      results.sort((a, b) =>
        sort === 'oldest'
          ? new Date(a.createdAt) -
            new Date(b.createdAt)
          : new Date(b.createdAt) -
            new Date(a.createdAt)
      );

      // =================================================
      // PAGINATION
      // =================================================

      const pageNum = Math.max(
        1,
        parseInt(page, 10) || 1
      );

      const limitNum = Math.min(
        100,
        Math.max(
          1,
          parseInt(limit, 10) || 20
        )
      );

      const total =
        results.length;

      const totalPages =
        Math.ceil(
          total / limitNum
        );

      const start =
        (pageNum - 1) *
        limitNum;

      res.json({
        success: true,

        data: results.slice(
          start,
          start + limitNum
        ),

        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,

          hasNext:
            pageNum <
            totalPages,

          hasPrev:
            pageNum > 1,
        },
      });
    } catch (err) {
      next(err);
    }
  })();
}

// =====================================================
// GET SINGLE LEAD
// =====================================================

function getLeadById(
  req,
  res,
  next
) {
  (async () => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from('leads')
        .select('*')
        .eq(
          'id',
          req.params.id
        )
        .eq(
          'client_id',
          req.client.id
        )
        .single();

      if (error || !data) {
        return res.status(404).json({
          success: false,

          error: {
            message:
              `Lead not found with id: ${req.params.id}`,

            status: 404,
          },
        });
      }

      res.json({
        success: true,
        data: mapLead(data),
      });
    } catch (err) {
      next(err);
    }
  })();
}

// =====================================================
// GET LEADS BY CLIENT
// =====================================================

function getLeadsByClient(
  req,
  res,
  next
) {
  (async () => {
    try {
      const clientId =
        req.client.id;

      const {
        status,
        sort = 'newest',
        page = 1,
        limit = 20,
      } = req.query;

      const {
        data,
        error,
      } = await supabase
        .from('leads')
        .select('*')
        .eq(
          'client_id',
          clientId
        );

      if (error) {
        throw error;
      }

      let results =
        data.map(mapLead);

      // =================================================
      // STATUS FILTER
      // =================================================

      if (status) {
        const statuses =
          status
            .split(',')
            .map(
              (s) => s.trim()
            );

        results =
          results.filter(
            (lead) =>
              statuses.includes(
                lead.status
              )
          );
      }

      // =================================================
      // SORT
      // =================================================

      results.sort((a, b) =>
        sort === 'oldest'
          ? new Date(a.createdAt) -
            new Date(b.createdAt)
          : new Date(b.createdAt) -
            new Date(a.createdAt)
      );

      // =================================================
      // PAGINATION
      // =================================================

      const pageNum =
        Math.max(
          1,
          parseInt(page, 10) || 1
        );

      const limitNum =
        Math.min(
          100,
          Math.max(
            1,
            parseInt(limit, 10) || 20
          )
        );

      const total =
        results.length;

      const totalPages =
        Math.ceil(
          total / limitNum
        );

      const start =
        (pageNum - 1) *
        limitNum;

      res.json({
        success: true,

        client: {
          clientId,
        },

        data:
          results.slice(
            start,
            start + limitNum
          ),

        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,

          hasNext:
            pageNum <
            totalPages,

          hasPrev:
            pageNum > 1,
        },
      });
    } catch (err) {
      next(err);
    }
  })();
}

// =====================================================
// CREATE LEAD
// =====================================================

function createLeadHandler(
  req,
  res,
  next
) {
  (async () => {
    try {
      console.log(
        'WEBHOOK DATA:',
        JSON.stringify(
          req.body,
          null,
          2
        )
      );

      // =================================================
      // STATUS MAP
      // =================================================

      const statusMap = {
        Interested:
          'interested',

        'Not Interested':
          'not_interested',

        'Needs Specialist':
          'callback',

        Unclear:
          'new',
      };

      let status =
        req.body.status ||
        req.body.lead_status ||
        'new';

      status =
        statusMap[status] ||
        status;

      // =================================================
      // VALIDATE
      // =================================================

      const validationData = {
        ...req.body,
        status,
      };

      const errors =
        validateLead(
          validationData
        );

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,

          error: {
            message:
              'Validation failed',

            details:
              errors,

            status: 400,
          },
        });
      }

      // =================================================
      // CUSTOM DATA
      // =================================================

      const standardFields = new Set([
  'id',

  'client_id',
  'clientId',

  'customer_name',
  'customerName',

  'business_name',
  'businessName',

  'phone',
  'phone_number',

  'email',

  // PACKAGE
  'package',
  'selected_package',
  'selectedPackage',

  // BUDGET
  'budget',
  'propertyPrice',
  'property_price',

  'status',
  'lead_status',
  'leadStatus',

  'summary',
  'call_summary',
  'callSummary',

  'call_duration',
  'callDuration',

  'language',

  'recording_url',
  'recordingUrl',
  'recording',
  'audio_url',
  'audioUrl',

  'transcript',
  'call_transcript',
  'callTranscript',

  'created_at',
  'createdAt',

  'updated_at',
  'updatedAt',
]);

      const customData = {};

      Object.entries(req.body || {})
        .forEach(([key, value]) => {
          if (
            !standardFields.has(key) &&
            value !== undefined &&
            value !== null &&
            value !== ''
          ) {
            customData[key] = value;
          }
        });

      // =================================================
      // PACKAGE
      // =================================================
      //
      // Accept all supported package names.
      //
      // =================================================

      const packageName =
        req.body.package ||
        req.body.selected_package ||
        req.body.selectedPackage ||
        '';

      // =================================================
      // BUILD DATABASE OBJECT
      // =================================================

      const newLead = {
        client_id:
          req.client.id,

        // =================================================
        // BASIC
        // =================================================

        customer_name:
          req.body.customerName ||
          req.body.customer_name ||
          '',

        business_name:
          req.body.businessName ||
          req.body.business_name ||
          '',

        phone:
          req.body.phone ||
          req.body.phone_number ||
          '',

        email:
          req.body.email ||
          '',

        // =================================================
        // PACKAGE
        // =================================================

        package:
  packageName || null,

// =================================================
// BUDGET
// =================================================

budget:
  req.body.budget ||
  req.body.propertyPrice ||
  req.body.property_price ||
  null,

// =================================================
// UNIVERSAL CUSTOM DATA
// =================================================

custom_data:
  customData,

        // =================================================
        // LEAD DATA
        // =================================================

        status:
          VALID_STATUSES.includes(
            status
          )
            ? status
            : 'new',

        summary:
          req.body.summary ||
          req.body.callSummary ||
          req.body.call_summary ||
          '',

        call_duration:
          req.body.callDuration ||
          req.body.call_duration ||
          0,

        language:
          req.body.language ||
          'en',

        recording_url:
          req.body.recordingUrl ||
          req.body.recording_url ||
          req.body.recording ||
          req.body.audio_url ||
          req.body.audioUrl ||
          '',

        transcript:
          req.body.transcript ||
          req.body.callTranscript ||
          req.body.call_transcript ||
          '',
      };

      console.log(
        'PACKAGE:',
        packageName || '—'
      );

      console.log(
        'CUSTOM DATA:',
        JSON.stringify(
          customData,
          null,
          2
        )
      );

      console.log(
        'DATABASE LEAD:',
        JSON.stringify(
          newLead,
          null,
          2
        )
      );

      // =================================================
      // INSERT
      // =================================================

      const {
        data,
        error,
      } = await supabase
        .from('leads')
        .insert(newLead)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const createdLead =
        mapLead(data);

      console.log(
        `[Voxora] New lead received: ${createdLead.customerName} (${createdLead.phone})`
      );

      console.log(
        `[Voxora] Package: ${createdLead.package || '—'}`
      );

      res.status(201).json({
        success: true,
        data: createdLead,
      });
    } catch (err) {
      next(err);
    }
  })();
}

// =====================================================
// UPDATE LEAD
// =====================================================

function updateLead(
  req,
  res,
  next
) {
  (async () => {
    try {
      // =================================================
      // STANDARD FIELDS
      // =================================================

      const allowedFields = [
        'customerName',
        'businessName',
        'phone',
        'email',
        'package',
        'status',
        'summary',
        'callDuration',
        'language',
        'recordingUrl',
        'transcript',
        'budget',
      ];

      const updates = {};

      for (
        const key of allowedFields
      ) {
        if (
          req.body[key] !==
          undefined
        ) {
          updates[key] =
            req.body[key];
        }
      }

      // =================================================
      // VALIDATE STATUS
      // =================================================

      if (
        updates.status &&
        !VALID_STATUSES.includes(
          updates.status
        )
      ) {
        return res.status(400).json({
          success: false,

          error: {
            message:
              `status must be one of: ${VALID_STATUSES.join(', ')}`,

            status: 400,
          },
        });
      }

      // =================================================
      // FRONTEND → DATABASE
      // =================================================

      const dbUpdates = {};

      if (
        updates.customerName !==
        undefined
      ) {
        dbUpdates.customer_name =
          updates.customerName;
      }

      if (
        updates.businessName !==
        undefined
      ) {
        dbUpdates.business_name =
          updates.businessName;
      }

      if (
        updates.phone !==
        undefined
      ) {
        dbUpdates.phone =
          updates.phone;
      }

      if (
        updates.email !==
        undefined
      ) {
        dbUpdates.email =
          updates.email;
      }

      // =================================================
      // PACKAGE
      // =================================================

      if (
        updates.package !==
        undefined
      ) {
        dbUpdates.package =
          updates.package;
      }

      if (
        updates.status !==
        undefined
      ) {
        dbUpdates.status =
          updates.status;
      }

      if (
        updates.summary !==
        undefined
      ) {
        dbUpdates.summary =
          updates.summary;
      }

      if (
        updates.callDuration !==
        undefined
      ) {
        dbUpdates.call_duration =
          updates.callDuration;
      }

      if (
        updates.language !==
        undefined
      ) {
        dbUpdates.language =
          updates.language;
      }

      if (
        updates.recordingUrl !==
        undefined
      ) {
        dbUpdates.recording_url =
          updates.recordingUrl;
      }

      if (
        updates.transcript !==
        undefined
      ) {
        dbUpdates.transcript =
          updates.transcript;
      }
      if (updates.budget !== undefined) {
  dbUpdates.budget = updates.budget;
}

      // =================================================
      // CUSTOM DATA UPDATE
      // =================================================

      if (
        req.body.customData !==
        undefined
      ) {
        dbUpdates.custom_data =
          req.body.customData;
      }

      // =================================================
      // UPDATED TIMESTAMP
      // =================================================

      dbUpdates.updated_at =
        new Date().toISOString();

      // =================================================
      // UPDATE SUPABASE
      // =================================================

      const {
        data,
        error,
      } = await supabase
        .from('leads')
        .update(dbUpdates)
        .eq(
          'id',
          req.params.id
        )
        .eq(
          'client_id',
          req.client.id
        )
        .select()
        .single();

      if (
        error ||
        !data
      ) {
        return res.status(404).json({
          success: false,

          error: {
            message:
              `Lead not found with id: ${req.params.id}`,

            status: 404,
          },
        });
      }

      res.json({
        success: true,
        data: mapLead(data),
      });
    } catch (err) {
      next(err);
    }
  })();
}

// =====================================================
// DELETE LEAD
// =====================================================

function deleteLead(
  req,
  res,
  next
) {
  (async () => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from('leads')
        .delete()
        .eq(
          'id',
          req.params.id
        )
        .eq(
          'client_id',
          req.client.id
        )
        .select()
        .single();

      if (
        error ||
        !data
      ) {
        return res.status(404).json({
          success: false,

          error: {
            message:
              `Lead not found with id: ${req.params.id}`,

            status: 404,
          },
        });
      }

      res.json({
        success: true,

        message:
          'Lead deleted successfully',

        data:
          mapLead(data),
      });
    } catch (err) {
      next(err);
    }
  })();
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  getAllLeads,
  getLeadById,
  getLeadsByClient,
  createLeadHandler,
  updateLead,
  deleteLead,
};