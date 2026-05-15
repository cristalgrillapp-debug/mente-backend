export default function Home() {
  return (
    <main style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#08080d', color: '#c9a96e',
      fontFamily: 'monospace', flexDirection: 'column', gap: '12px'
    }}>
      <div style={{ fontSize: '32px', fontStyle: 'italic' }}>Mente</div>
      <div style={{ fontSize: '12px', color: '#5a5650', letterSpacing: '3px' }}>BACKEND ATIVO</div>
    </main>
  )
}
