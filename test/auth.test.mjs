// Smoke test for the auth helpers (hashes, cookie parsing, validation).
// Run: node test/auth.test.mjs
import {
  cookieValue, hashPassword, hashToken, isPasswordValid, normalizeUsername, verifyPassword
} from '../server/utils/credentials.ts'

let failed = 0
function check (name, cond) {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`)
  if (!cond) failed++
}

const password = 'супер-пароль123'
const hash = await hashPassword(password)
check('hash has scrypt prefix with params', hash.startsWith('scrypt$32768$8$1$'))
check('verify correct password', await verifyPassword(password, hash))
check('reject wrong password', !(await verifyPassword('супер-пароль12', hash)))
check('salted: same password hashes differently', (await hashPassword('same-pass-123')) !== (await hashPassword('same-pass-123')))

const parts = hash.split('$')
const tampered = ['scrypt', '1024', parts[2], parts[3], parts[4], parts[5]].join('$')
check('reject tampered params', !(await verifyPassword(password, tampered)))
check('reject tampered hash bytes', !(await verifyPassword(password, `${hash.slice(0, -4)}AAAA`)))
check('reject malformed hash', !(await verifyPassword('whatever', 'bcrypt$1$2$3$4$5')))

check('hashToken is sha256 hex', /^[0-9a-f]{64}$/.test(hashToken('token')))
check('hashToken differs per input', hashToken('a') !== hashToken('b'))

check('cookieValue finds among others', cookieValue('a=1; monstrata_session=abc.def-12; b=2', 'monstrata_session') === 'abc.def-12')
check('cookieValue missing name', cookieValue('a=1', 'monstrata_session') === null)
check('cookieValue missing header', cookieValue(null, 'monstrata_session') === null)
check('cookieValue decodes percent-escapes', cookieValue('x=%61%62%63', 'x') === 'abc')
check('cookieValue empty value is null', cookieValue('x=', 'x') === null)

check('normalizeUsername trims', normalizeUsername('  root  ') === 'root')
check('normalizeUsername rejects empty', normalizeUsername('   ') === null)
check('normalizeUsername rejects long', normalizeUsername('x'.repeat(65)) === null)
check('normalizeUsername rejects non-string', normalizeUsername(42) === null)
check('isPasswordValid bounds', isPasswordValid('12345678') && !isPasswordValid('1234567') && !isPasswordValid('x'.repeat(1025)) && !isPasswordValid(42))

console.log(failed === 0 ? '\nAll checks passed' : `\n${failed} checks FAILED`)
process.exit(failed === 0 ? 0 : 1)
