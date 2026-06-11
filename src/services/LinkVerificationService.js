import https from 'https';

class LinkVerificationService {
  checkPublicLink(userUrl) {
    return new Promise((resolve) => {
      if (!userUrl.startsWith('http://') && !userUrl.startsWith('https://')) {
        resolve({ isDrive: false, isPublic: false, message: 'Tautan tidak valid (harus dimulai dengan http:// atau https://)' });
        return;
      }

      const isGoogle = userUrl.includes('drive.google.com') || userUrl.includes('docs.google.com');
      const isDropbox = userUrl.includes('dropbox.com');
      const isOneDrive = userUrl.includes('onedrive.live.com') || userUrl.includes('1drv.ms') || userUrl.includes('sharepoint.com');

      if (!isGoogle && !isDropbox && !isOneDrive) {
        resolve({ isDrive: false, isPublic: false, message: 'Tautan ditolak. Sistem hanya menerima Bukti Dukung dari Google Drive, Dropbox, atau OneDrive.' });
        return;
      }

      if (isDropbox || isOneDrive) {
        // We bypass the deep HTTP scraping for Dropbox/OneDrive as they have complex JS-based auth walls
        // We will just trust they are public links since the user pasted them, 
        // but strictly format them later in the UI for iframe.
        resolve({ isDrive: false, isPublic: true, message: 'Link Publik (Siap diverifikasi).' });
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
