const { v4: uuidv4 } = require('uuid');

function createClient(data) {
  const now = new Date().toISOString();
  return {
    clientId: uuidv4(),
    companyName: data.companyName,
    website: data.website || '',
    email: data.email,
    phone: data.phone || '',
    createdDate: now,
    updatedAt: now,
  };
}

function validateClient(data) {
  const errors = [];

  if (!data.companyName || typeof data.companyName !== 'string' || !data.companyName.trim()) {
    errors.push('companyName is required');
  }

  if (!data.email || typeof data.email !== 'string' || !data.email.trim()) {
    errors.push('email is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.email && !emailRegex.test(data.email)) {
    errors.push('email must be a valid email address');
  }

  if (data.website && typeof data.website === 'string' && data.website.trim()) {
    try {
      new URL(data.website);
    } catch {
      errors.push('website must be a valid URL (e.g. https://example.com)');
    }
  }

  return errors;
}

module.exports = {
  createClient,
  validateClient,
};
