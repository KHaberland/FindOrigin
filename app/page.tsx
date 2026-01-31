export default function Home() {
  return (
    <main style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍 FindOrigin</h1>
      <p style={{ fontSize: '1.2rem', color: '#666' }}>
        Telegram-бот для поиска первоисточников информации
      </p>
      <div style={{ 
        marginTop: '2rem', 
        padding: '1.5rem', 
        backgroundColor: 'white', 
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <p>📱 Найдите бота в Telegram и отправьте текст для проверки</p>
      </div>
    </main>
  )
}
