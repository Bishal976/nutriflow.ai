import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16

function getDerivedKey(): Buffer {
  const secret = process.env.FIELD_ENCRYPTION_SECRET
  const salt = process.env.FIELD_ENCRYPTION_SALT
  if (!secret || !salt) throw new Error('FIELD_ENCRYPTION_SECRET and FIELD_ENCRYPTION_SALT must be set')
  return scryptSync(secret, salt, KEY_LENGTH) as Buffer
}

export function encryptField(plaintext: string): string {
  const key = getDerivedKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptField(ciphertext: string): string {
  const key = getDerivedKey()
  const [ivHex, tagHex, encHex] = ciphertext.split(':')

  if (!ivHex || !tagHex || !encHex) throw new Error('Invalid encrypted field format')

  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')
}

export function encryptFieldNullable(value: string | null | undefined): string | null {
  if (value == null) return null
  return encryptField(value)
}

export function decryptFieldNullable(value: string | null | undefined): string | null {
  if (value == null) return null
  return decryptField(value)
}
