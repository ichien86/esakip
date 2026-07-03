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
        });

        res.on('end', () => {
          // If it's a 404
          if (statusCode === 404) {
            resolve({ isDrive: true, isPublic: false, message: 'File tidak ditemukan (404).' });
            return;
          }

          // Check title for access denied/request access pages
          const titleMatch = data.match(/<title>(.*?)<\/title>/i);
          let rawTitle = titleMatch ? titleMatch[1] : '';
          const titleLower = rawTitle.toLowerCase();
          
          let cleanTitle = rawTitle
            .replace(/\s*-\s*Google Drive$/i, '')
            .replace(/\s*-\s*Google Docs$/i, '')
            .replace(/\s*-\s*Google Sheets$/i, '')
            .replace(/\s*-\s*Google Slides$/i, '');

          if (titleLower.includes('meet google drive') || titleLower.includes('google drive - access denied') || titleLower.includes('meminta akses')) {
            resolve({ isDrive: true, isPublic: false, message: 'Link bersifat Privat (Butuh Akses / Login).', title: '' });
          } else {
            // Cek ekstensi terlarang (Arsip & Program)
            const forbiddenExts = ['.zip', '.rar', '.7z', '.tar', '.gz', '.exe', '.apk', '.msi', '.bat'];
            const hasForbiddenExt = forbiddenExts.some(ext => cleanTitle.toLowerCase().endsWith(ext));

            if (hasForbiddenExt) {
              resolve({ isDrive: true, isPublic: false, message: 'Jenis file ditolak (Arsip / Program tidak diizinkan).', title: cleanTitle });
            } else {
              // It's a 200 OK and not a known private page title
              resolve({ isDrive: true, isPublic: true, message: 'Link Publik (Siap diverifikasi).', title: cleanTitle });
            }
          }
        });
      }).on('error', (err) => {
        resolve({ isDrive: false, isPublic: false, message: 'Tautan tidak dapat dihubungi: ' + err.message, title: '' });
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
