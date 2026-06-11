/**
 * Transform standard sharing links into embed/preview links for iframes.
 */
export function getEmbedUrl(rawUrl) {
  if (!rawUrl) return '';

  try {
    const urlObj = new URL(rawUrl);
    
    // 1. Google Drive (Files)
    // from: https://drive.google.com/file/d/12345/view?usp=sharing
    // to:   https://drive.google.com/file/d/12345/preview
    if (urlObj.hostname.includes('drive.google.com') && urlObj.pathname.includes('/view')) {
      const newPath = urlObj.pathname.replace('/view', '/preview');
      return `${urlObj.origin}${newPath}`;
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
