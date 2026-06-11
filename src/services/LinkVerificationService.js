import https from 'https';

class LinkVerificationService {
  checkPublicLink(userUrl) {
    return new Promise((resolve) => {
      if (!userUrl.startsWith('http://') && !userUrl.startsWith('https://')) {
        resolve({ isDrive: false, isPublic: false, message: 'Tautan tidak valid (harus dimulai dengan http:// atau https://)' });
        return;
      }

      if (!userUrl.includes('drive.google.com') && !userUrl.includes('docs.google.com')) {
        resolve({ isDrive: false, isPublic: true, message: 'Bukan link Google Drive (tautan luar).' });
        return;
      }

      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      };

      https.get(userUrl, options, (res) => {
        const { statusCode } = res;
        const location = res.headers.location;

        if (statusCode >= 300 && statusCode < 400 && location) {
          if (location.includes('accounts.google.com') || location.includes('ServiceLogin')) {
            resolve({ isDrive: true, isPublic: false, message: 'Link bersifat Privat (Butuh Akses / Login).' });
            return;
          }
          this.checkPublicLink(location).then(resolve);
          return;
        }

        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
          if (data.includes('ServiceLogin') || data.includes('signIn') || data.includes('accounts.google.com')) {
            res.destroy();
            resolve({ isDrive: true, isPublic: false, message: 'Link bersifat Privat (Butuh Akses / Login).' });
          }
        });

        res.on('end', () => {
          if (data.includes('ServiceLogin') || data.includes('signIn') || data.includes('accounts.google.com')) {
            resolve({ isDrive: true, isPublic: false, message: 'Link bersifat Privat (Butuh Akses / Login).' });
          } else {
            resolve({ isDrive: true, isPublic: true, message: 'Link Publik (Siap diverifikasi).' });
          }
        });
      }).on('error', (err) => {
        resolve({ isDrive: false, isPublic: false, message: 'Tautan tidak dapat dihubungi: ' + err.message });
      });
    });
  }

  async verify(url) {
    if (!url) {
      const err = new Error('URL wajib dikirimkan');
      err.status = 400;
      throw err;
    }
    return await this.checkPublicLink(url);
  }
}

export default new LinkVerificationService();
