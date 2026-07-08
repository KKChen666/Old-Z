import { getToken, getEffectiveApiBase } from './api';

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadCallbacks {
  onProgress?: (progress: UploadProgress) => void;
}

/**
 * 上传文件到 OSS（通过后端代理）
 * 使用 XMLHttpRequest 以支持上传进度追踪。
 * OSS 未配置时后端直接报错，不再回退到 base64 或本地 blob。
 */
export function uploadToOSS(
  file: File,
  folder: string = 'uploads',
  callbacks?: UploadCallbacks
): Promise<{ url: string; key: string }> {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const apiBase = getEffectiveApiBase();
    const xhr = new XMLHttpRequest();

    xhr.open('POST', `${apiBase}/files/upload`);

    // 请求头
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-file-name', encodeURIComponent(file.name));
    xhr.setRequestHeader('x-file-folder', folder);

    // 上传进度
    xhr.upload.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable && callbacks?.onProgress) {
        callbacks.onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.success) {
          resolve(data.data);
        } else {
          reject(new Error(data.error || `上传失败 (${xhr.status})`));
        }
      } catch {
        reject(new Error(`服务器响应异常 (${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('网络连接失败，无法上传文件'));
    };

    xhr.ontimeout = () => {
      reject(new Error('上传超时，请检查网络状况'));
    };

    xhr.timeout = 120000; // 2 分钟超时

    xhr.send(file);
  });
}

/**
 * OSS 是否已配置（由后端控制）
 */
export function isOSSConfigured(): boolean {
  return true;
}
