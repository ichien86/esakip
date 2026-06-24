import { SignJWT, jwtVerify } from 'jose';

const getJwtSecretKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length === 0) {
    throw new Error('The environment variable JWT_SECRET is not set.');
  }
  return secret;
};

/**
 * Verifies the user's JWT token and returns its payload if it's valid.
 * @param {string} token 
 * @returns {Promise<any | null>} payload
 */
export const verifyAuth = async (token) => {
  try {
    const verified = await jwtVerify(
      token,
      new TextEncoder().encode(getJwtSecretKey())
    );
    return verified.payload;
  } catch (error) {
    return null; // Token is invalid or expired
  }
};

/**
 * Creates a JWT token for the user.
 * @param {object} payload 
 * @returns {Promise<string>} token
 */
export const signJwt = async (payload) => {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // Token expires in 1 day
    .sign(new TextEncoder().encode(getJwtSecretKey()));
    
  return token;
};
