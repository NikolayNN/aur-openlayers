import {escapeHtml} from './html-escape.utils';

describe('escapeHtml', () => {
  it('escapes &, <, >, ", \'', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('does not change a safe string', () => {
    expect(escapeHtml('Hello, world! 123')).toBe('Hello, world! 123');
  });

  it('converts null/undefined to empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('converts non-strings to string', () => {
    expect(escapeHtml(123)).toBe('123');
    expect(escapeHtml(true)).toBe('true');
    expect(escapeHtml(false)).toBe('false');
  });

  it('escapes repeated characters', () => {
    expect(escapeHtml('&&&<<<>>>""\'\'')).toBe(
      '&amp;&amp;&amp;&lt;&lt;&lt;&gt;&gt;&gt;&quot;&quot;&#39;&#39;',
    );
  });

  it('escapes ampersand correctly even if input already contains entities', () => {
    // Важно: функция не "понимает" сущности, она экранирует текст как есть.
    // Это ожидаемое поведение для защиты innerHTML.
    expect(escapeHtml('&lt;div&gt;')).toBe('&amp;lt;div&amp;gt;');
  });

  it('escapes a typical XSS payload into plain text', () => {
    const payload = `<img src=x onerror="alert('xss')">`;
    expect(escapeHtml(payload)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;',
    );
  });
});
