# Security Policy

## 🔒 Reporting a Vulnerability

**Please DO NOT open a public GitHub issue for security vulnerabilities.**

We take security seriously and appreciate responsible disclosure.

### How to Report

**Email:** security@[yourdomain].com

**Include in your report:**
1. Description of the vulnerability
2. Steps to reproduce the issue
3. Potential impact and severity
4. Proof of concept (if applicable)
5. Suggested fix (if you have one)
6. Your contact information

### What to Expect

- **Acknowledgment**: Within 48 hours of report
- **Initial assessment**: Within 1 week
- **Status updates**: Every 1-2 weeks until resolved
- **Fix timeline**: Depends on severity (critical issues prioritized)
- **Credit**: Public acknowledgment in security advisory (unless you prefer to remain anonymous)

### Scope

**In scope:**
- Authentication/authorization bypasses
- Payment verification vulnerabilities
- SQL injection, XSS, CSRF
- API endpoint security issues
- Denial of service vulnerabilities
- Sensitive data exposure
- Cryptographic weaknesses

**Out of scope:**
- Social engineering attacks
- Physical attacks
- Issues in third-party dependencies (report to upstream)
- Theoretical vulnerabilities without proof of exploit
- Issues requiring extensive user interaction

## 🛡️ Security Measures

### Payment Security

- **On-chain verification**: All payments verified on Solana blockchain before API execution
- **Idempotency**: Reference UUIDs prevent double-spending
- **Amount validation**: Exact USDC amount and recipient verified
- **No private key storage**: Application never handles private keys

### API Security

- **Rate limiting**: Token bucket algorithm per wallet/IP
- **CORS**: Restricted to authorized origins
- **Input validation**: All inputs sanitized and validated
- **Helmet headers**: Security headers enabled
- **Request timeouts**: 30-second maximum for upstream calls
- **Content-type whitelist**: Only approved content types proxied

### Database Security

- **Parameterized queries**: No SQL injection vulnerabilities
- **Minimal permissions**: Database user has only required permissions
- **Connection pooling**: Secure connection management
- **No sensitive data**: Wallet addresses are public; no private information stored

### Infrastructure Security

- **Environment variables**: Secrets in environment, never in code
- **HTTPS only**: All production traffic over TLS
- **Dependency scanning**: Regular audits with pnpm audit
- **No debug endpoints**: Debug routes disabled in production

## 📊 Supported Versions

| Version | Supported          | End of Support |
| ------- | ------------------ | -------------- |
| 1.x.x   | ✅ Yes            | TBD            |
| < 1.0   | ❌ No             | -              |

We support the latest major version. Security updates backported to previous major version if needed.

## 🔐 Known Security Considerations

### Solana Network

- **RPC dependency**: Payment verification requires reliable Solana RPC access
- **Network congestion**: High congestion may delay verification (not a vulnerability)
- **Devnet vs Mainnet**: Ensure correct network configuration for production

### Payment Flow

- **Race conditions**: Idempotency via unique reference prevents double-execution
- **Partial payments**: On-chain verification ensures exact amount received
- **Wrong recipient**: Verification checks payout wallet matches blink creator

### Rate Limiting

- **Current implementation**: In-memory (resets on restart)
- **Planned improvement**: Redis-backed rate limiting for distributed deployments
- **Bypass potential**: Changing IP/wallet can bypass current limits (acceptable for MVP)

### Upstream API Calls

- **Trust boundary**: BlinkBazaar proxies to third-party APIs
- **User risk**: Upstream API security is user's responsibility
- **Timeout protection**: 30-second timeout prevents hanging requests
- **Content filtering**: Only whitelisted content-types returned

## 🚨 Security Best Practices for Users

### For Creators (Blink Owners)

- ✅ Use dedicated wallet for payouts (not your main wallet)
- ✅ Set reasonable prices (prevent spam, ensure value)
- ✅ Monitor dashboard for suspicious activity
- ✅ Only expose APIs you control or have permission to share
- ❌ Don't expose APIs with sensitive operations
- ❌ Don't set price too low (prevent DoS via spam calls)

### For Users (Blink Callers)

- ✅ Verify blink details before approving payment
- ✅ Check recipient wallet address
- ✅ Start with small amounts to test
- ✅ Use wallet with limited funds for testing
- ❌ Don't approve transactions you don't understand
- ❌ Don't share wallet private keys

## 🔄 Security Update Process

### Critical Vulnerabilities (CVSS 9.0-10.0)

- Fix within 24-48 hours
- Immediate patch release
- Security advisory published
- Notify all known production users

### High Severity (CVSS 7.0-8.9)

- Fix within 1 week
- Patch release scheduled
- Security advisory published
- Email notification to users

### Medium Severity (CVSS 4.0-6.9)

- Fix within 2-4 weeks
- Included in next regular release
- Documented in changelog

### Low Severity (CVSS 0.1-3.9)

- Fix in regular development cycle
- Documented in changelog

## 📝 Security Checklist for Contributors

When contributing code:

- [ ] No secrets or credentials in code
- [ ] User inputs are validated and sanitized
- [ ] SQL queries use parameterized statements
- [ ] Authentication/authorization properly implemented
- [ ] Error messages don't leak sensitive information
- [ ] No console.log with sensitive data
- [ ] Dependencies are up to date
- [ ] New endpoints have rate limiting (if applicable)
- [ ] Security implications documented

## 🔍 Security Audit History

| Date | Auditor | Scope | Findings | Status |
|------|---------|-------|----------|--------|
| TBD  | TBD     | Full app | TBD   | Planned |

*We plan to conduct professional security audits before mainnet production deployment.*

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Solana Security Best Practices](https://docs.solana.com/developing/programming-model/overview)
- [Solana Pay Specification](https://docs.solanapay.com/)
- [CWE Top 25](https://cwe.mitre.org/top25/)

## 🏆 Hall of Fame

Security researchers who have responsibly disclosed vulnerabilities:

*No reports yet - be the first!*

## 💰 Bug Bounty Program

**Status:** Not currently active

We plan to launch a bug bounty program in the future. Stay tuned!

## 📞 Contact

- **Security issues**: security@[domain].com
- **General questions**: [GitHub Discussions](https://github.com/yourorg/BlinkBazaar/discussions)
- **Non-security bugs**: [GitHub Issues](https://github.com/yourorg/BlinkBazaar/issues)

---

**Thank you for helping keep BlinkBazaar and our users safe!** 🙏
