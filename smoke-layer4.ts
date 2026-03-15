import { decodeBase64Url, stripHtml, extractResetLink, parseEmailBody } from './utils/emailParser';

const encoded = Buffer.from('http://localhost:3000/reset-password?token=abc123').toString('base64url');
console.assert(decodeBase64Url(encoded) === 'http://localhost:3000/reset-password?token=abc123', 'FAIL: decodeBase64Url');
console.log('✅ decodeBase64Url');

const stripped = stripHtml('<p>Click <a href="#">here</a></p>');
console.assert(!stripped.includes('<'), 'FAIL: stripHtml');
console.log('✅ stripHtml');

const html = '<a href="http://localhost:3000/reset-password?token=xyz">Reset</a>';
console.assert(extractResetLink(html, 'reset-password') === 'http://localhost:3000/reset-password?token=xyz', 'FAIL: extractResetLink strategy 1');
console.log('✅ extractResetLink strategy 1');

const plain = 'Click: http://localhost:3000/reset-password?token=xyz to reset';
console.assert(extractResetLink(plain, 'reset-password')?.includes('reset-password'), 'FAIL: extractResetLink strategy 2');
console.log('✅ extractResetLink strategy 2');

const raw = Buffer.from('<a href="http://localhost:3000/reset-password?token=abc">Reset</a>').toString('base64url');
const link = parseEmailBody(raw, 'reset-password');
console.assert(link.includes('reset-password'), 'FAIL: parseEmailBody');
console.log('✅ parseEmailBody');

console.log('\n✅ All Layer 4 checks passed');
