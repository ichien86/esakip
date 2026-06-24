import { describe, it, expect } from 'vitest';
import { signJwt, verifyAuth } from '../auth';

describe('Auth Utilities', () => {
  it('should sign and verify a JWT successfully', async () => {
    // Mock the environment variable for testing
    process.env.JWT_SECRET = 'super_secret_test_key_12345';
    
    const payload = { nip: '123456789' };
    const token = await signJwt(payload);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    
    const verifiedPayload = await verifyAuth(token);
    expect(verifiedPayload).toBeDefined();
    expect(verifiedPayload.nip).toBe(payload.nip);
  });

  it('should return null for an invalid token', async () => {
    process.env.JWT_SECRET = 'super_secret_test_key_12345';
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI...invalid';
    
    const verifiedPayload = await verifyAuth(invalidToken);
    expect(verifiedPayload).toBeNull();
  });
});
