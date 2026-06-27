/**
 * Utility to extract and validate the user role and payload 
 * from the Next.js proxy's 'x-user-data' header.
 * 
 * Prevents Broken Access Control by ensuring the client
 * cannot spoof roles via headers or body payloads.
 */
export function getValidatedUser(request, requestedRole = '') {
  const userDataHeader = request.headers.get('x-user-data');
  
  if (!userDataHeader) {
    return { user: null, role: '' };
  }

  try {
    const user = JSON.parse(userDataHeader);
    
    // Memastikan role yang diminta benar-benar ada di daftar peran user
    if (requestedRole && user.roles && user.roles.includes(requestedRole)) {
      return { user, role: requestedRole };
    }
    
    // Jika user berbohong (spoofing) atau tidak menyertakan role, 
    // kita jatuhkan ke role pertamanya (default fallback).
    return { user, role: (user.roles && user.roles[0]) || '' };
  } catch (e) {
    return { user: null, role: '' };
  }
}
