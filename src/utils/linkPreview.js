/**
 * Transform standard sharing links into embed/preview links for iframes.
 */
export function getEmbedUrl(rawUrl) {
  if (!rawUrl) return '';

  try {
    const urlObj = new URL(rawUrl);
    
    // 1. Google Drive (Files & Folders)
    if (urlObj.hostname.includes('drive.google.com')) {
      // For single files: /file/d/ID/view -> /file/d/ID/preview
      if (urlObj.pathname.includes('/view')) {
        const newPath = urlObj.pathname.replace('/view', '/preview');
        return `${urlObj.origin}${newPath}`;
      }
      
      // For folders: /drive/folders/ID or /drive/u/0/folders/ID
      if (urlObj.pathname.includes('/folders/')) {
        const parts = urlObj.pathname.split('/');
        const folderId = parts[parts.length - 1]; // usually the last part
        if (folderId) {
          return `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;
        }
      }
    }

    // 2. Google Docs/Sheets/Slides
    // from: https://docs.google.com/document/d/12345/edit?usp=sharing
    // to:   https://docs.google.com/document/d/12345/preview
    if (urlObj.hostname.includes('docs.google.com') && urlObj.pathname.includes('/edit')) {
      const newPath = urlObj.pathname.replace('/edit', '/preview');
      return `${urlObj.origin}${newPath}`;
    }

    // 3. Dropbox
    // from: https://www.dropbox.com/s/12345/file.pdf?dl=0
    // to:   https://www.dropbox.com/s/12345/file.pdf?raw=1
    if (urlObj.hostname.includes('dropbox.com')) {
      urlObj.searchParams.set('raw', '1');
      urlObj.searchParams.delete('dl');
      return urlObj.toString();
    }

    // 4. OneDrive (Consumer)
    // from: https://onedrive.live.com/?authkey=...&cid=...&id=...
    // to:   https://onedrive.live.com/embed?cid=...&resid=...&authkey=...
    // Note: OneDrive's URL structure is complex. The safest replacement for standard view links:
    if (urlObj.hostname.includes('onedrive.live.com')) {
      if (urlObj.pathname === '/' || urlObj.pathname === '/redir') {
        urlObj.pathname = '/embed';
        return urlObj.toString();
      }
    }
    
    // SharePoint / OneDrive Business
    // from: https://tenant.sharepoint.com/:b:/s/site/filename?e=xyz
    // to:   https://tenant.sharepoint.com/:b:/s/site/filename?e=xyz&action=embedview
    if (urlObj.hostname.includes('sharepoint.com')) {
      urlObj.searchParams.set('action', 'embedview');
      return urlObj.toString();
    }

    // Fallback: return original
    return rawUrl;
  } catch (e) {
    // If invalid URL, just return it as is
    return rawUrl;
  }
}

/**
 * Extract a user-friendly document/file name from a URL.
 */
export function getFilenameFromUrl(url) {
  if (!url) return '';
  try {
    const decoded = decodeURIComponent(url);
    const urlObj = new URL(decoded);
    
    if (urlObj.hostname.includes('drive.google.com')) {
      return 'Dokumen Google Drive';
    }
    if (urlObj.hostname.includes('docs.google.com')) {
      if (urlObj.pathname.includes('/document/')) return 'Dokumen Google Docs';
      if (urlObj.pathname.includes('/spreadsheets/')) return 'Google Sheets';
      if (urlObj.pathname.includes('/presentation/')) return 'Google Slides';
      if (urlObj.pathname.includes('/forms/')) return 'Google Form';
      return 'Dokumen Google Workspace';
    }
    if (urlObj.hostname.includes('dropbox.com')) {
      const pathname = urlObj.pathname;
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
      return filename || 'Dokumen Dropbox';
    }
    if (urlObj.hostname.includes('onedrive.live.com') || urlObj.hostname.includes('sharepoint.com') || urlObj.hostname.includes('1drv.ms')) {
      const pathname = urlObj.pathname;
      let filename = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (filename.includes('?')) {
        filename = filename.substring(0, filename.indexOf('?'));
      }
      return filename || 'Dokumen OneDrive';
    }

    const pathname = urlObj.pathname;
    let filename = pathname.substring(pathname.lastIndexOf('/') + 1);
    if (filename.includes('?')) {
      filename = filename.substring(0, filename.indexOf('?'));
    }
    return filename || 'Dokumen Bukti Dukung';
  } catch (e) {
    const parts = url.split('/');
    let lastPart = parts[parts.length - 1] || 'Dokumen Bukti Dukung';
    if (lastPart.includes('?')) {
      lastPart = lastPart.substring(0, lastPart.indexOf('?'));
    }
    return lastPart;
  }
}

/**
 * Safely parse a buktiDukung value which could be a serialized JSON array or a legacy single URL string.
 */
export function parseBuktiDukung(buktiDukungStr) {
  if (!buktiDukungStr) return [];
  const trimmed = buktiDukungStr.trim();
  try {
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          name: item.name || getFilenameFromUrl(item.url),
          url: item.url || ''
        }));
      }
    }
  } catch (e) {
    // Fail silently and fall back to single link parsing
  }

  // Fallback to single legacy URL
  return [{
    name: getFilenameFromUrl(trimmed),
    url: trimmed
  }];
}
