import Script from 'next/script';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'FindOrigin — проверка источника',
  description: 'Проверка текста на первоисточник через Telegram Mini App',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#2481cc',
};

export default function TmaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <div
        className="tma-root"
        style={{
          margin: 0,
          minHeight: '100dvh',
          minHeight: '100vh',
          padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
          boxSizing: 'border-box',
          backgroundColor: 'var(--tg-theme-bg-color, #fff)',
          color: 'var(--tg-theme-text-color, #000)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {children}
      </div>
    </>
  );
}
