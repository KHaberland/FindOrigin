export const metadata = {
  title: 'FindOrigin Bot',
  description: 'Telegram-бот для поиска первоисточников',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
