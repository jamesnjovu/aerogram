// Provide dummy but schema-valid env so modules that read config.ts can be imported in tests.
process.env.API_ID ||= "123456";
process.env.API_HASH ||= "0123456789abcdef0123456789abcdef";
process.env.SESSION_ENC_KEY ||= "0".repeat(64);
process.env.JWT_SECRET ||= "test-secret-that-is-long-enough-000";
