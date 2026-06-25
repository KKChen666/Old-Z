import OSS from 'ali-oss';

// 阿里云OSS配置
const ossConfig = {
  region: import.meta.env.VITE_OSS_REGION || 'oss-cn-beijing',
  accessKeyId: import.meta.env.VITE_OSS_ACCESS_KEY_ID || '',
  accessKeySecret: import.meta.env.VITE_OSS_ACCESS_KEY_SECRET || '',
  bucket: import.meta.env.VITE_OSS_BUCKET || 'oldzz',
  endpoint: import.meta.env.VITE_OSS_ENDPOINT || 'https://oss-cn-beijing.aliyuncs.com',
};

// 生成OSS文件路径
function generateOSSKey(fileName: string, folder: string = 'uploads'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const ext = fileName.split('.').pop() || '';
  const nameWithoutExt = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
  return `${folder}/${timestamp}_${random}_${nameWithoutExt}.${ext}`;
}

// 跟踪本地 blob URL 以便清理
const localBlobUrls: string[] = [];

// 页面卸载时清理所有本地 blob URL
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    localBlobUrls.forEach(url => URL.revokeObjectURL(url));
  });
}

// 上传文件到OSS
export async function uploadToOSS(
  file: File,
  folder: string = 'uploads'
): Promise<{ url: string; key: string }> {
  const key = generateOSSKey(file.name, folder);

  // 未配置凭证时回退到本地预览
  if (!ossConfig.accessKeyId || !ossConfig.accessKeySecret) {
    console.warn('OSS credentials not configured, using local preview');
    const blobUrl = URL.createObjectURL(file);
    localBlobUrls.push(blobUrl);
    return {
      url: blobUrl,
      key: `local/${file.name}`,
    };
  }

  const client = new OSS({
    region: ossConfig.region,
    accessKeyId: ossConfig.accessKeyId,
    accessKeySecret: ossConfig.accessKeySecret,
    bucket: ossConfig.bucket,
  });

  try {
    const result = await client.put(key, file);
    return {
      url: result.url,
      key: result.name,
    };
  } catch (error) {
    console.error('OSS upload error:', error);
    // 上传失败时回退到本地预览
    const blobUrl = URL.createObjectURL(file);
    localBlobUrls.push(blobUrl);
    return {
      url: blobUrl,
      key: `local/${file.name}`,
    };
  }
}

// 检查OSS配置是否完整
export function isOSSConfigured(): boolean {
  return !!(ossConfig.accessKeyId && ossConfig.accessKeySecret);
}
