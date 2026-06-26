import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Papa from 'papaparse';

interface CsvViewerProps {
  url: string;
}

// 通用的文件加载函数
async function fetchAsText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'text';
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

export default function CsvViewer({ url }: CsvViewerProps) {
  const [data, setData] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCsv = async () => {
      try {
        setLoading(true);
        setError(null);

        const text = await fetchAsText(url);

        const result = Papa.parse(text, {
          header: false,
          skipEmptyLines: true,
        });

        setData(result.data as string[][]);
      } catch (err) {
        console.error('Failed to load CSV:', err);
        setError('CSV 文件加载失败');
      } finally {
        setLoading(false);
      }
    };
    loadCsv();
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

  const maxCols = data.reduce((max, row) => Math.max(max, row.length), 0);

  return (
    <div className="flex-1 overflow-auto">
      {data.length > 0 ? (
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
                  列 {colIndex + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
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
          文件为空
        </div>
      )}
    </div>
  );
}
