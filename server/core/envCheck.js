/**
 * Prodakşn mühiti üçün konfiqurasiya yoxlaması (saf funksiya — testlərdə istifadə olunur).
 * Qaytarır: problemli env açarlarının siyahısı (boşdursa — hər şey qaydasındadır).
 */
const DEFAULTS = {
  ACCESS_SECRET_KEY: "starter_access_secret_key",
  REFRESH_SECRET_KEY: "starter_refresh_secret_key",
  ENCRYPTION_KEY: "starter_32_char_encryption_key!!",
  DEFAULT_ADMIN_PASSWORD: "Admin123!",
  DEFAULT_OPERATOR_PASSWORD: "Operator123!",
};

const envProblems = (env) => {
  const problems = [];
  for (const [key, weak] of Object.entries(DEFAULTS)) {
    // DEFAULT_OPERATOR_EMAIL="" → demo operator yaradılmır, parol tələb olunmur
    if (
      key === "DEFAULT_OPERATOR_PASSWORD" &&
      env.DEFAULT_OPERATOR_EMAIL === ""
    )
      continue;
    if (!env[key] || env[key] === weak) problems.push(key);
  }
  if (!env.MONGODB_URI) problems.push("MONGODB_URI");
  if (env.ACCESS_SECRET_KEY && env.ACCESS_SECRET_KEY.length < 32)
    problems.push("ACCESS_SECRET_KEY(min 32)");
  return problems;
};

export { envProblems };
