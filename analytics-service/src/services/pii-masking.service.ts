import { SecurityContext } from '../types';
import config from '../config';
import crypto from 'crypto';

export class PIIMaskingService {
  private readonly maskingStrategies = {
    full: this.fullMasking.bind(this),
    partial: this.partialMasking.bind(this),
    hash: this.hashMasking.bind(this),
  };

  maskData(data: any, securityContext: SecurityContext): any {
    const { preset, piiAccess } = securityContext;

    // If user has full PII access, return data as-is
    if (piiAccess) {
      return data;
    }

    // If PII masking is disabled for this preset, return data as-is
    if (!preset.piiMasking.enabled) {
      return data;
    }

    const strategy = this.maskingStrategies[preset.piiMasking.maskingStrategy];
    const piiFields = preset.piiMasking.fields;

    return this.recursiveMask(data, piiFields, strategy);
  }

  private recursiveMask(obj: any, piiFields: string[], maskFunction: (value: string, field: string) => string): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.recursiveMask(item, piiFields, maskFunction));
    }

    if (obj && typeof obj === 'object') {
      const masked: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (this.isPIIField(key, piiFields) && typeof value === 'string') {
          masked[key] = maskFunction(value, key);
        } else if (typeof value === 'object' && value !== null) {
          masked[key] = this.recursiveMask(value, piiFields, maskFunction);
        } else {
          masked[key] = value;
        }
      }
      
      return masked;
    }

    return obj;
  }

  private isPIIField(fieldName: string, piiFields: string[]): boolean {
    return piiFields.some(piiField => 
      fieldName.toLowerCase().includes(piiField.toLowerCase()) ||
      piiField.toLowerCase().includes(fieldName.toLowerCase())
    );
  }

  private fullMasking(value: string, field: string): string {
    const fieldMappings: Record<string, string> = {
      email: '***@***.***',
      phone: '***-***-****',
      ssn: '***-**-****',
      name: '[REDACTED]',
      firstname: '[REDACTED]',
      lastname: '[REDACTED]',
      address: '[REDACTED]',
      dob: '[REDACTED]',
      dateofbirth: '[REDACTED]',
    };

    const lowerField = field.toLowerCase();
    return fieldMappings[lowerField] || '[REDACTED]';
  }

  private partialMasking(value: string, field: string): string {
    const lowerField = field.toLowerCase();
    
    if (lowerField.includes('email')) {
      const [username, domain] = value.split('@');
      const maskedUsername = username.substring(0, 2) + '***' + username.substring(username.length - 1);
      return `${maskedUsername}@${domain}`;
    }
    
    if (lowerField.includes('phone')) {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length >= 10) {
        return `***-***-${cleaned.substring(cleaned.length - 4)}`;
      }
      return '***-***-****';
    }
    
    if (lowerField.includes('ssn')) {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length >= 4) {
        return `***-**-${cleaned.substring(cleaned.length - 4)}`;
      }
      return '***-**-****';
    }
    
    if (lowerField.includes('name')) {
      if (value.length <= 2) {
        return '**';
      }
      return value.substring(0, 1) + '***' + value.substring(value.length - 1);
    }
    
    if (lowerField.includes('address')) {
      const parts = value.split(' ');
      if (parts.length >= 2) {
        return `${parts[0]} *** ${parts[parts.length - 1]}`;
      }
      return '***';
    }
    
    // Default partial masking
    if (value.length <= 4) {
      return '****';
    }
    return value.substring(0, 2) + '***' + value.substring(value.length - 2);
  }

  private hashMasking(value: string, field: string): string {
    // Create a consistent hash for the value
    const hash = crypto
      .createHash('sha256')
      .update(value + config.jwt.secret) // Add secret to prevent rainbow table attacks
      .digest('hex')
      .substring(0, 8);
    
    const fieldPrefix = field.toLowerCase().substring(0, 3);
    return `${fieldPrefix}_${hash}`;
  }

  // Utility function to apply masking to SQL query results
  maskQueryResults(results: any[], securityContext: SecurityContext): any[] {
    return results.map(row => this.maskData(row, securityContext));
  }

  // Generate SQL for column-level masking
  generateMaskedColumnsSQL(columns: string[], securityContext: SecurityContext): string[] {
    const { preset, piiAccess } = securityContext;

    if (piiAccess || !preset.piiMasking.enabled) {
      return columns;
    }

    return columns.map(column => {
      if (this.isPIIField(column, preset.piiMasking.fields)) {
        switch (preset.piiMasking.maskingStrategy) {
          case 'full':
            return `'${this.fullMasking('', column)}' AS ${column}`;
          case 'partial':
            return `CASE 
              WHEN LOWER(${column}) LIKE '%@%' THEN 
                SUBSTRING(${column}, 1, 2) || '***' || SUBSTRING(${column}, POSITION('@' IN ${column}) - 1, 1) || 
                SUBSTRING(${column}, POSITION('@' IN ${column}))
              WHEN ${column} ~ '^[0-9-]+$' AND LENGTH(${column}) >= 10 THEN
                '***-***-' || RIGHT(${column}, 4)
              WHEN LENGTH(${column}) <= 4 THEN
                '****'
              ELSE
                LEFT(${column}, 2) || '***' || RIGHT(${column}, 2)
            END AS ${column}`;
          case 'hash':
            return `SHA256(${column} || '${config.jwt.secret}') AS ${column}`;
          default:
            return column;
        }
      }
      return column;
    });
  }

  // Validate that PII masking is properly applied
  validatePIIMasking(originalData: any, maskedData: any, securityContext: SecurityContext): boolean {
    const { preset, piiAccess } = securityContext;

    // If user has PII access or masking is disabled, data should be unchanged
    if (piiAccess || !preset.piiMasking.enabled) {
      return JSON.stringify(originalData) === JSON.stringify(maskedData);
    }

    // Check that PII fields are properly masked
    const piiFields = preset.piiMasking.fields;
    
    for (const field of piiFields) {
      const originalValue = this.extractFieldValue(originalData, field);
      const maskedValue = this.extractFieldValue(maskedData, field);
      
      if (originalValue && typeof originalValue === 'string' && 
          maskedValue && typeof maskedValue === 'string') {
        
        // For full masking, value should be completely redacted
        if (preset.piiMasking.maskingStrategy === 'full') {
          if (maskedValue === originalValue) {
            return false; // Not masked
          }
        }
        
        // For partial masking, value should be partially visible
        if (preset.piiMasking.maskingStrategy === 'partial') {
          if (maskedValue === originalValue || maskedValue === '[REDACTED]') {
            return false; // Either not masked or fully masked
          }
        }
        
        // For hash masking, value should be a hash
        if (preset.piiMasking.maskingStrategy === 'hash') {
          const expectedHash = crypto
            .createHash('sha256')
            .update(originalValue + config.jwt.secret)
            .digest('hex')
            .substring(0, 8);
          
          if (!maskedValue.includes(expectedHash)) {
            return false; // Not properly hashed
          }
        }
      }
    }
    
    return true;
  }

  private extractFieldValue(obj: any, fieldName: string): string | null {
    if (!obj || typeof obj !== 'object') {
      return null;
    }

    // Check direct field match
    if (fieldName in obj && typeof obj[fieldName] === 'string') {
      return obj[fieldName];
    }

    // Check nested objects
    for (const [key, value] of Object.entries(obj)) {
      if (key.toLowerCase().includes(fieldName.toLowerCase()) && typeof value === 'string') {
        return value;
      }
      
      if (typeof value === 'object' && value !== null) {
        const nestedValue = this.extractFieldValue(value, fieldName);
        if (nestedValue) {
          return nestedValue;
        }
      }
    }
    
    return null;
  }
}

export const piiMaskingService = new PIIMaskingService();