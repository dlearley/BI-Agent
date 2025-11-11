import { Request, Response, NextFunction } from 'express';
import config from '../config';
import { AuthenticatedRequest } from './auth';

// Extend Express Request type for our middleware
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const hipaaCompliance = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!config.hipaa.enabled) {
    next();
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Check if user has PII access permission
  const hasPIIAccess = req.user.permissions.includes('view_pii' as any);
  
  if (!hasPIIAccess) {
    // Add HIPAA compliance headers
    res.setHeader('X-HIPAA-Compliant', 'true');
    res.setHeader('X-PII-Masked', 'true');
  }

  next();
};

export const applyHIPAARedaction = (data: any, user: any): any => {
  if (!config.hipaa.enabled || user.permissions.includes('view_pii')) {
    return data;
  }

  // Recursive function to redact PII from data
  const redactPII = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(item => redactPII(item));
    }

    if (obj && typeof obj === 'object') {
      const redacted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Redact common PII fields
        if (isPIIField(key)) {
          redacted[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          redacted[key] = redactPII(value);
        } else {
          redacted[key] = value;
        }
      }
      return redacted;
    }

    return obj;
  };

  return redactPII(data);
};

const isPIIField = (fieldName: string): boolean => {
  const piiFields = [
    'name', 'firstName', 'lastName', 'fullName', 'email', 'phone', 'address',
    'ssn', 'socialSecurityNumber', 'dob', 'dateOfBirth', 'id', 'userId',
    'applicantId', 'candidateId', 'employeeId', 'patientId'
  ];

  return piiFields.some(pii => 
    fieldName.toLowerCase().includes(pii.toLowerCase())
  );
};

export const enforceMinimumThreshold = (data: any): any => {
  if (!config.hipaa.enabled) {
    return data;
  }

  // If data is an array and count is below threshold, return aggregated data
  if (Array.isArray(data) && data.length < config.hipaa.minThreshold) {
    return {
      aggregated: true,
      count: data.length,
      message: 'Data aggregated for privacy compliance'
    };
  }

  // If data is an object with count field below threshold
  if (data && typeof data === 'object' && 'count' in data && 
      typeof data.count === 'number' && data.count < config.hipaa.minThreshold) {
    return {
      aggregated: true,
      count: data.count,
      message: 'Data aggregated for privacy compliance'
    };
  }

  return data;
};