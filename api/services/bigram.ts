/**
 * Bigram 分词器 — 从 SpringNote note_index.rs (lines 693-720) 移植。
 *
 * 算法：将输入小写化，遍历每对相邻字符。
 * 每对字符编码为：b + hex((prev_code << 21) | current_code)
 *
 * 原理：
 *   - CJK 文本没有单词边界，FTS5 默认分词器无法正确处理
 *   - 通过 bigram 编码，将每对字符转为 hex token
 *   - 配合 FTS5 tokenize='unicode61' 按空格分词
 *   - content='' (contentless) 模式节省存储
 *
 * 示例：
 *   bigramTokenStream("搜索") → "b14cb7d22"
 *   bigramTokenStream("hello") → "b68b65 b65b6c b6cb6c b6cb6f"
 */

/**
 * 将文本转为空格分隔的 bigram hex token 流。
 * 返回空字符串当输入少于 2 个字符时。
 */
export function bigramTokenStream(value: string): string {
  const normalized = value.toLowerCase();
  const chars = [...normalized];
  const pairCount = Math.max(0, chars.length - 1);

  if (pairCount === 0) {
    return '';
  }

  const tokens: string[] = new Array(pairCount);

  for (let i = 0; i < pairCount; i++) {
    const prevCode = BigInt(chars[i].codePointAt(0)!);
    const currCode = BigInt(chars[i + 1].codePointAt(0)!);
    // 与 SpringNote 完全一致的编码：(prev << 21) | current
    const pair = (prevCode << 21n) | currCode;
    tokens[i] = 'b' + pair.toString(16);
  }

  return tokens.join(' ');
}

/**
 * 从查询关键词构建 FTS5 MATCH 表达式。
 * 每个查询被转为 bigram token 并加上双引号（短语匹配）。
 * 多个查询之间用 OR 连接。
 *
 * 仅包含 >= 2 字符的查询词（与 SpringNote 的 MIN_CONTENT_QUERY_CHARS 一致）。
 *
 * 返回 null 如果没有有效查询词。
 */
export function bigramSearchExpression(queries: string[]): string | null {
  const seen = new Set<string>();
  const phrases: string[] = [];

  for (const query of queries) {
    const trimmed = query.trim();
    if ([...trimmed].length < 2) {
      continue; // 跳过过短的查询
    }
    const tokens = bigramTokenStream(trimmed);
    if (!tokens) continue;
    if (seen.has(tokens)) continue;
    seen.add(tokens);
    phrases.push(`"${tokens}"`);
  }

  return phrases.length > 0 ? phrases.join(' OR ') : null;
}

/**
 * 从文本中提取前 N 个字符作为预览。
 */
export function extractPreview(text: string, maxChars = 120): string {
  if (!text) return '';

  // 跳过头部的 Markdown 标题
  let body = text;
  const lines = text.split('\n');
  if (lines[0]?.startsWith('# ')) {
    body = lines.slice(1).join('\n');
  }

  // 去除空行和首行空白
  const cleaned = body.trim();
  const chars = [...cleaned];

  if (chars.length <= maxChars) {
    return cleaned;
  }

  return chars.slice(0, maxChars).join('') + '...';
}

/**
 * 从 Markdown 内容中提取标题。
 * 优先使用第一个 # 标题行，否则使用第一个非空行，截断到 28 字符。
 * 与 SpringNote 的 title_from_content 逻辑一致。
 */
export function extractTitle(content: string, fallbackName: string): string {
  if (!content) return fallbackName;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim();
    }
    if (trimmed) {
      const chars = [...trimmed];
      return chars.length <= 28 ? trimmed : chars.slice(0, 28).join('') + '...';
    }
  }

  return fallbackName;
}
