'use client';

import { useState } from 'react';

const MIN_TEXT_LENGTH = 20;

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
      };
    };
  }
}

export default function TmaPage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    | { success: true; analysis: { confidence: number; explanation: string; sources: Array<{ url: string; title: string; relevance: number; reason: string; isLikelyOriginal?: boolean }> } }
    | { success: false; error: string; errorCode: string }
    | null
  >(null);

  const confidenceEmoji = result?.success
    ? result.analysis.confidence >= 70
      ? '🟢'
      : result.analysis.confidence >= 40
        ? '🟡'
        : '🔴'
    : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length < MIN_TEXT_LENGTH) return;

    const initData = typeof window !== 'undefined' ? (window.Telegram?.WebApp?.initData ?? '') : '';
    if (!initData) {
      setResult({ success: false, error: 'Откройте приложение из Telegram.', errorCode: 'unauthorized' });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/tma/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, initData }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({
          success: false,
          error: data?.error ?? 'Ошибка запроса',
          errorCode: data?.errorCode ?? 'internal',
        });
        return;
      }
      setResult(data);
    } catch {
      setResult({
        success: false,
        error: 'Нет связи с сервером. Проверьте интернет.',
        errorCode: 'internal',
      });
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = text.trim().length >= MIN_TEXT_LENGTH && !loading;

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        padding: 16,
        boxSizing: 'border-box',
      }}
    >
      <h1
        style={{
          margin: '0 0 8px',
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--tg-theme-text-color, #000)',
        }}
      >
        🔍 FindOrigin
      </h1>
      <p
        style={{
          margin: '0 0 16px',
          fontSize: 14,
          color: 'var(--tg-theme-hint-color, #999)',
        }}
      >
        Вставьте текст для проверки на первоисточник (минимум {MIN_TEXT_LENGTH} символов).
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Скопируйте сюда текст или ссылку t.me/..."
          minLength={MIN_TEXT_LENGTH}
          rows={6}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 12,
            fontSize: 15,
            lineHeight: 1.4,
            border: '1px solid var(--tg-theme-hint-color, #ccc)',
            borderRadius: 12,
            resize: 'vertical',
            backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
            color: 'var(--tg-theme-text-color, #000)',
          }}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            marginTop: 16,
            padding: '14px 20px',
            fontSize: 16,
            fontWeight: 600,
            border: 'none',
            borderRadius: 12,
            backgroundColor: canSubmit
              ? 'var(--tg-theme-button-color, #2481cc)'
              : 'var(--tg-theme-hint-color, #ccc)',
            color: 'var(--tg-theme-button-text-color, #fff)',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          Проверить
        </button>

        {loading && (
          <>
            <style
              dangerouslySetInnerHTML={{
                __html: '@keyframes tma-spin{to{transform:rotate(360deg)}}',
              }}
            />
            <div
              style={{
                marginTop: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                color: 'var(--tg-theme-hint-color, #666)',
                fontSize: 14,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: '3px solid var(--tg-theme-hint-color, #ddd)',
                  borderTopColor: 'var(--tg-theme-button-color, #2481cc)',
                  borderRadius: '50%',
                  animation: 'tma-spin 0.8s linear infinite',
                }}
              />
              <span>Анализирую текст... Это может занять несколько секунд.</span>
            </div>
          </>
        )}
      </form>

      {result?.success && (
        <section
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 12,
            backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
            border: '1px solid var(--tg-theme-hint-color, #eee)',
          }}
        >
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--tg-theme-text-color, #000)',
            }}
          >
            🔎 Результаты анализа
          </h2>
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--tg-theme-text-color, #000)',
            }}
          >
            {confidenceEmoji} Уверенность: {result.analysis.confidence}%
          </p>
          <p
            style={{
              margin: '0 0 16px',
              fontSize: 14,
              lineHeight: 1.45,
              color: 'var(--tg-theme-text-color, #000)',
            }}
          >
            {result.analysis.explanation}
          </p>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--tg-theme-text-color, #000)',
            }}
          >
            Источники:
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {result.analysis.sources.slice(0, 5).map((source, i) => (
              <li
                key={source.url}
                style={{
                  marginBottom: 10,
                  fontSize: 14,
                  lineHeight: 1.4,
                  color: 'var(--tg-theme-text-color, #000)',
                }}
              >
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--tg-theme-link-color, #2481cc)',
                    textDecoration: 'none',
                  }}
                >
                  {source.title.length > 60 ? source.title.slice(0, 60) + '…' : source.title}
                </a>
                <span
                  style={{
                    display: 'block',
                    marginTop: 2,
                    fontSize: 13,
                    color: 'var(--tg-theme-hint-color, #666)',
                  }}
                >
                  Релевантность: {source.relevance}%
                  {source.reason ? ` — ${source.reason}` : ''}
                </span>
              </li>
            ))}
          </ul>
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 12,
              color: 'var(--tg-theme-hint-color, #999)',
              fontStyle: 'italic',
            }}
          >
            Проверьте источники для подтверждения информации.
          </p>
        </section>
      )}

      {result && !result.success && (
        <section
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 12,
            backgroundColor: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
            border: '1px solid var(--tg-theme-hint-color, #ddd)',
          }}
        >
          <h2
            style={{
              margin: '0 0 8px',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--tg-theme-text-color, #000)',
            }}
          >
            ⚠️ Ошибка
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.45,
              color: 'var(--tg-theme-text-color, #000)',
            }}
          >
            {result.error}
          </p>
          {result.errorCode === 'search_limit' && (
            <p
              style={{
                margin: '12px 0 0',
                fontSize: 13,
                color: 'var(--tg-theme-hint-color, #666)',
              }}
            >
              Бесплатный API: 250 запросов в месяц. Лимит обновится в начале следующего месяца.
            </p>
          )}
          {result.errorCode === 'unauthorized' && (
            <p
              style={{
                margin: '12px 0 0',
                fontSize: 13,
                color: 'var(--tg-theme-hint-color, #666)',
              }}
            >
              Откройте приложение из Telegram (меню бота или кнопка «Проверить»).
            </p>
          )}
        </section>
      )}
    </main>
  );
}
