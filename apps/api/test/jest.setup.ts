process.env["NODE_ENV"] = "test";
process.env["JWT_SECRET"] ??= "test-only-jwt-secret-value-at-least-32-chars";
process.env["LOG_LEVEL"] ??= "error";

process.env["STORAGE_ENDPOINT"] ??= "http://localhost:9000";
process.env["STORAGE_BUCKET"] ??= "clinic-test-files";
process.env["STORAGE_ACCESS_KEY_ID"] ??= "test_access_key";
process.env["STORAGE_SECRET_ACCESS_KEY"] ??= "test_secret_key";
process.env["STORAGE_FORCE_PATH_STYLE"] ??= "true";

process.env["SECRETS_MASTER_KEY"] ??= Buffer.alloc(32, 7).toString("base64");
