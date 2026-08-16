const { v4: uuidv4 } = require('uuid');

const VALID_STATUSES = [
  'new',
  'interested',
  'not_interested',
  'callback',
  'qualified',
  'converted',
  'do_not_call',
];

function createLead(data) {
  const now = new Date().toISOString();
  return {
    leadId: uuidv4(),
    clientId: data.clientId,
    customerName: data.customerName || '',
    businessName: data.businessName || '',
    phone: data.phone || '',
    email: data.email || '',
    package: data.package || '',
    status: VALID_STATUSES.includes(data.status) ? data.status : 'new',
    summary: data.summary || '',
    callDuration: data.callDuration || 0,
    language: data.language || 'en',
    createdAt: now,
    updatedAt: now,
  };
}

function validateLead(data) {
  const errors = [];

  if (!data.customerName || typeof data.customerName !== 'string' || !data.customerName.trim()) {
    errors.push('customerName is required');
  }

  if (!data.phone || typeof data.phone !== 'string' || !data.phone.trim()) {
    errors.push('phone is required');
  }

  if (data.status && !VALID_STATUSES.includes(data.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (data.callDuration !== undefined && (isNaN(data.callDuration) || data.callDuration < 0)) {
    errors.push('callDuration must be a non-negative number');
  }

  return errors;
}

module.exports = {
  createLead,
  validateLead,
  VALID_STATUSES,
};
