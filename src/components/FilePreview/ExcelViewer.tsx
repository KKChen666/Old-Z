import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExcelViewerProps {
  url: string;
}

// 通用的文件加载函数
async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) {
        resolve(xhr.response);
      } else {
        reject(new Error(`Failed to fetch: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send();
  });
}

export default function ExcelViewer({ url }: ExcelViewerProps) {
  const [sheets, setSheets] = useState<{ name: string; data: any[][] }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExcel = async () => {
      try {
        setLoading(true);
        setError(null);

        const arrayBuffer = await fetchAsArrayBuffer(url);
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const sheetsData = workbook.SheetNames.map((name) => {
          const worksheet = workbook.Sheets[name];
          const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          return { name, data };
        });

        setSheets(sheetsData);
        setActiveSheet(0);
      } catch (err) {
        console.error('Failed to load Excel:', err);
        setError('Excel 文件加载失败');
      } finally {
        setLoading(false);
      }
    };
    loadExcel();
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        {error}
      </div>
    );
  }

  const currentSheet = sheets[activeSheet];
  const maxCols = currentSheet?.data.reduce((max, row) => Math.max(max, row.length), 0) || 0;

  return (
    <div className="flex flex-col h-full">
      {/* Sheet 标签 */}
      {sheets.length > 1 && (
        <div className="flex items-center gap-1 p-2 bg-ink-900/80 border-b border-ink-700/50 overflow-x-auto">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              onClick={() => setActiveSheet(index)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap ${
                activeSheet === index
                  ? 'bg-ink-700 text-gold-400'
                  : 'text-parchment-400 hover:text-parchment-200 hover:bg-ink-800'
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* 表格内容 */}
      <div className="flex-1 overflow-auto">
        {currentSheet && currentSheet.data.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-ink-800/80 sticky top-0">
                <th className="border border-ink-700 px-3 py-2 text-xs font-medium text-parchment-300 w-12 bg-ink-900">
                  #
                </th>
                {Array.from({ length: maxCols }).map((_, colIndex) => (
                  <th
                    key={colIndex}
                    className="border border-ink-700 px-3 py-2 text-xs font-medium text-parchment-300 min-w-[100px]"
                  >
                    {String.fromCharCode(65 + (colIndex % 26))}
                    {colIndex >= 26 ? Math.floor(colIndex / 26) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentSheet.data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-ink-800/30">
                  <td className="border border-ink-700 px-3 py-2 text-xs text-parchment-400 bg-ink-900/50 text-center">
                    {rowIndex + 1}
                  </td>
                  {Array.from({ length: maxCols }).map((_, colIndex) => (
                    <td
                      key={colIndex}
                      className="border border-ink-700 px-3 py-2 text-sm text-parchment-200"
                    >
                      {row[colIndex] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center justify-center h-full text-parchment-400">
            工作表为空
          </div>
        )}
      </div>
    </div>
  );
}
