const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Validates required fields for client creation.
 * Returns an array of error strings (empty if valid).
 */
function validateClientInput({
  company_name,
  email,
  agent_id,
  password,
}) {
  const errors = [];

  if (!company_name?.trim()) {
    errors.push('company_name is required.');
  }

  if (!email?.trim()) {
    errors.push('email is required.');
  }

  if (!agent_id?.trim()) {
    errors.push('agent_id is required.');
  }

  if (!password?.trim()) {
    errors.push('password is required.');
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('email format is invalid.');
  }

  return errors;
}

// ─── Controllers ────────────────────────────────────────────────────────────

/**
 * GET /clients
 * Returns all clients (password_hash excluded).
 */
async function getAllClients(req, res) {
  const { data, error } = await supabase
    .from('clients')
    .select(
      'id, company_name, email, phone, agent_id, display_name, status, created_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getAllClients]', error.message);

    return res.status(500).json({
      error: 'Failed to fetch clients.',
    });
  }

  res.json(data);
}

/**
 * GET /clients/:id
 * Returns a single client by UUID (password_hash excluded).
 */
async function getClientById(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('clients')
    .select(
      'id, company_name, email, phone, agent_id, display_name, status, created_at'
    )
    .eq('id', id)
    .single();

  if (error) {
    console.error('[getClientById]', error.message);

    const statusCode = error.code === 'PGRST116' ? 404 : 500;

    return res.status(statusCode).json({
      error:
        statusCode === 404
          ? 'Client not found.'
          : 'Failed to fetch client.',
    });
  }

  res.json(data);
}

/**
 * POST /clients
 * Creates a new client after validating input and hashing the password.
 */
async function createClientHandler(req, res) {
  const {
    company_name,
    email,
    phone,
    agent_id,
    password,
    status = 'active',
  } = req.body;

  // Validate required input
  const errors = validateClientInput({
    company_name,
    email,
    agent_id,
    password,
  });

  if (errors.length) {
    return res.status(400).json({
      errors,
    });
  }

  // Check for duplicate email
  const { data: existing, error: duplicateError } = await supabase
    .from('clients')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (duplicateError) {
    console.error(
      '[createClient] duplicate email check:',
      duplicateError.message
    );

    return res.status(500).json({
      error: 'Failed to check existing client.',
    });
  }

  if (existing) {
    return res.status(409).json({
      error: 'A client with this email already exists.',
    });
  }

  // Hash password
  let password_hash;

  try {
    password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  } catch (hashErr) {
    console.error(
      '[createClient] bcrypt error:',
      hashErr.message
    );

    return res.status(500).json({
      error: 'Failed to process password.',
    });
  }

  // Insert into Supabase
  const { data, error } = await supabase
    .from('clients')
    .insert([
      {
        company_name: company_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        agent_id: agent_id.trim(),
        password_hash,
        status,
      },
    ])
    .select(
      'id, company_name, email, phone, agent_id, display_name, status, created_at'
    )
    .single();

  if (error) {
    console.error('[createClient]', error.message);

    return res.status(500).json({
      error: 'Failed to create client.',
    });
  }

  res.status(201).json(data);
}

/**
 * PATCH /clients/:id
 * Partially updates a client.
 * Password is re-hashed if provided.
 */
async function updateClient(req, res) {
  const { id } = req.params;

  console.log('========== UPDATE REQUEST ==========');
  console.log('ID:', id);
  console.log('BODY:', req.body);

  const {
    company_name,
    email,
    phone,
    agent_id,
    status,
    password,
    display_name,
  } = req.body;

  const updates = {};

  // Company name
  if (company_name !== undefined) {
    updates.company_name = company_name.trim();
  }

  // Phone
  if (phone !== undefined) {
    updates.phone = phone.trim() || null;
  }

  // Agent ID
  if (agent_id !== undefined) {
    updates.agent_id = agent_id.trim();
  }

  // Status
  if (status !== undefined) {
    updates.status = status;
  }

  // Display name
  if (display_name !== undefined) {
    updates.display_name = display_name.trim();
  }

  // Email
  if (email !== undefined) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'email format is invalid.',
      });
    }

    updates.email = email.trim().toLowerCase();
  }

  // Password
  if (password !== undefined) {
    if (!password.trim()) {
      return res.status(400).json({
        error: 'password cannot be empty.',
      });
    }

    try {
      updates.password_hash = await bcrypt.hash(
        password,
        SALT_ROUNDS
      );
    } catch (hashErr) {
      console.error(
        '[updateClient] bcrypt error:',
        hashErr.message
      );

      return res.status(500).json({
        error: 'Failed to process password.',
      });
    }
  }

  // Nothing to update
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      error: 'No valid fields provided for update.',
    });
  }

  // Update Supabase
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select(
      'id, company_name, email, phone, agent_id, display_name, status, created_at'
    )
    .single();

  if (error) {
    console.error('[updateClient]', error.message);

    const statusCode = error.code === 'PGRST116' ? 404 : 500;

    return res.status(statusCode).json({
      error:
        statusCode === 404
          ? 'Client not found.'
          : 'Failed to update client.',
    });
  }

  console.log('UPDATED DATA:', data);

  res.json(data);
}

/**
 * DELETE /clients/:id
 * Hard-deletes a client by UUID.
 */
async function deleteClient(req, res) {
  const { id } = req.params;

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteClient]', error.message);

    return res.status(500).json({
      error: 'Failed to delete client.',
    });
  }

  res.status(204).send();
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  getAllClients,
  getClientById,
  createClientHandler,
  updateClient,
  deleteClient,
};