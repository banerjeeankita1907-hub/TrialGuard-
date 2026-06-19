export const metadata = {
  title: 'TrialGuard – Never forget a free trial',
  description: 'Free reminder before your trial ends and your card is charged.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f5f7fa', fontFamily: '-apple-system, sans-serif' }}>{children}</body>
    </html>
  )
}
