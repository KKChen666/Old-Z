import { getToken, getEffectiveApiBase } from './api';

// 跟踪本地 blob URL 以便清理
const localBlobUrls: string[] = [];

// 页面卸载时清理所有本地 blob URL
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    localBlobUrls.forEach(url => URL.revokeObjectURL(url));
  });
}

/**
 * 上传文件 — 通过后端代理上传到 OSS，凭证不暴露在前端
 * 后端 POST /api/files/upload 接收 raw binary，代传 OSS 后返回 URL
 */
export async function uploadToOSS(
  file: File,
  folder: string = 'uploads'
): Promise<{ url: string; key: string }> {
  try {
    const token = getToken();
    const apiBase = getEffectiveApiBase();

    const res = await fetch(`${apiBase}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': file.type || 'application/octet-stream',
        'x-file-name': encodeURIComponent(file.name),
        'x-file-folder': folder,
      },
      body: file,
    });

    if (!res.ok) {
      let errorMsg = `上传失败 ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData.error) errorMsg = errorData.error;
      } catch {}
      throw new Error(errorMsg);
    }

    const data = await res.json();
    if (!data.success) throw new Error(data.error || '上传失败');
    return data.data;
  } catch (error: any) {
    // 网络错误或后端不可用时回退到本地预览
    console.warn('Upload via backend failed, falling back to local preview:', error.message);
    const blobUrl = URL.createObjectURL(file);
    localBlobUrls.push(blobUrl);
    return {
      url: blobUrl,
      key: `local/${file.name}`,
    };
  }
}

/**
 * 检查 OSS 是否已配置（后端配置）
 * 前端无法直接知道，默认返回 true 让上传尝试走后端
 */
export function isOSSConfigured(): boolean {
  return true;
}
