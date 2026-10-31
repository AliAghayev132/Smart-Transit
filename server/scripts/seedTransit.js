import { mongoDBService, bootstrapTransit } from "#services";

/**
 * Demo xətlər və avtobuslar.
 *
 * Usage:
 *   node scripts/seedTransit.js          # baza boşdursa doldurur
 *   node scripts/seedTransit.js --reset  # xətləri/avtobusları silib yenidən yaradır
 */
const run = async () => {
  await mongoDBService.connect();
  const reset = process.argv.includes("--reset");
  const created = await bootstrapTransit({ reset });
  console.log(
    created
      ? "✅ Demo xətlər yaradıldı"
      : "ℹ️  Baza artıq doludur (--reset ilə yenidən yaradın)",
  );
  await mongoDBService.disconnect();
  process.exit(0);
};

run().catch(async (e) => {
  console.error("❌ Seed failed:", e);
  await mongoDBService.disconnect();
  process.exit(1);
});
