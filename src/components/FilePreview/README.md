# 文件预览组件

纯前端文件预览组件，支持多种文件格式的在线预览。

## 支持格式

| 格式 | 扩展名 | 库 |
|------|--------|-----|
| PDF | .pdf | pdfjs-dist |
| Word | .doc, .docx | mammoth |
| Excel | .xls, .xlsx | xlsx (SheetJS) |
| CSV | .csv | papaparse |
| 图片 | .jpg, .png, .gif, .webp, .svg, .bmp | 浏览器原生 |
| 视频 | .mp4, .webm, .ogg, .mov, .avi | 浏览器原生 |
| 音频 | .mp3, .wav, .ogg, .aac, .flac | 浏览器原生 |
| 文本/代码 | .txt, .md, .json, .js, .ts, .py 等 | 浏览器原生 |

## 使用方法

```tsx
import FilePreview from '@/components/FilePreview';

function MyComponent() {
  const [previewFile, setPreviewFile] = useState(null);

  return (
    <>
      <button onClick={() => setPreviewFile({ url: '...', name: 'file.pdf' })}>
        预览
      </button>

      {previewFile && (
        <FilePreview
          url={previewFile.url}
          name={previewFile.name}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </>
  );
}
```

## 功能特性

- **PDF**: 翻页、缩放
- **图片**: 缩放、旋转
- **Excel**: 多 Sheet 切换
- **通用**: 下载、新窗口打开、ESC 关闭

## 依赖

```bash
npm install pdfjs-dist mammoth xlsx papaparse
```
