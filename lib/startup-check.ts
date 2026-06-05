const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'FIELD_ENCRYPTION_SECRET',
  'FIELD_ENCRYPTION_SALT',
]

if (typeof window === 'undefined') {
  const missing = REQUIRED.filter(k => !process.env[k])
  if (missing.length > 0) {
    const list = missing.map(k => `  • ${k}`).join('\n')
    const msg = `[NutriFlow] Missing required environment variables:\n${list}`
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg)
    } else {
      console.warn(`\x1b[33m${msg}\x1b[0m`)
    }
  }
}

export {}
