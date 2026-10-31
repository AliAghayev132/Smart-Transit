import { User, Route, Bus } from "#models";
import { HashService } from "#services/HashService.js";
import { GeoService } from "#services/GeoService.js";
import { fleetService } from "#services/FleetService.js";
import { analyticsService } from "#services/AnalyticsService.js";
import { demandService } from "#services/DemandService.js";
import { presenceService } from "#services/PresenceService.js";
import { DispatchService } from "#services/DispatchService.js";
import socketService from "#services/SocketService.js";
import { config } from "#config";
import { seedRoutes } from "#constants";

/**
 * Create a default admin user on first boot if none exists.
 * Credentials come from DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD.
 */
const bootstrapAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      console.log("✅ Admin already exists:", existingAdmin.email);
      return;
    }

    const hashedPassword = await HashService.hashPassword(
      config.defaultAdmin.password,
    );

    const admin = await User.create({
      firstName: "Default",
      lastName: "Admin",
      email: config.defaultAdmin.email,
      password: hashedPassword,
      role: "admin",
      status: "active",
    });

    console.log("🚀 Default admin created successfully!");
    console.log("   Email:", admin.email);
    // Parol yalnız development-də göstərilir (prodakşn loqlarına sızmasın)
    if (process.env.NODE_ENV !== "production")
      console.log("   Password:", config.defaultAdmin.password);
    console.log("   ⚠️  Please change the password after first login!");
  } catch (error) {
    console.error("❌ Error creating default admin:", error.message);
  }
};

/**
 * Demo dispetçer hesabı (operator rolu). Operatorlar qeydiyyatdan keçmir —
 * admin və ya bu bootstrap tərəfindən yaradılır.
 */
const bootstrapOperator = async () => {
  try {
    const { email, password } = config.defaultOperator;
    if (!email || !password) return;
    if (await User.findOne({ email })) return;
    await User.create({
      firstName: "Növbətçi",
      lastName: "Dispetçer",
      email,
      password: await HashService.hashPassword(password),
      role: "operator",
      status: "active",
    });
    console.log(
      `🚀 Demo operator yaradıldı: ${email}${process.env.NODE_ENV !== "production" ? ` / ${password}` : ""}`,
    );
  } catch (error) {
    console.error("❌ Error creating default operator:", error.message);
  }
};

/**
 * Xətlər və avtobuslar (baza boşdursa demo məlumat).
 * @param {{reset?: boolean}} options
 */
const LEGACY_DEMO_NUMBERS = ["1", "5", "13", "88"];

const bootstrapTransit = async ({ reset = false } = {}) => {
  // Köhnə 4 xəttlik demo məlumat qalıbsa — real xətlərlə avtomatik əvəz et
  if (!reset) {
    const numbers = (await Route.find({}, { number: 1 }).lean())
      .map((r) => r.number)
      .sort();
    if (
      numbers.length &&
      numbers.join() === [...LEGACY_DEMO_NUMBERS].sort().join()
    ) {
      console.log(
        "♻️  Köhnə demo xətlər tapıldı — Bakı xətləri ilə əvəz olunur",
      );
      reset = true;
    }
  }
  if (reset) {
    await Promise.all([Route.deleteMany({}), Bus.deleteMany({})]);
    console.log("🗑️  Xətlər və avtobuslar silindi");
  } else if ((await Route.countDocuments()) > 0) {
    return false;
  }
  for (const r of seedRoutes) {
    const route = await Route.create({
      number: r.number,
      name: r.name,
      color: r.color,
      stops: r.stops,
      path: r.path,
    });
    const geom = GeoService.buildGeometry(route);
    const buses = Array.from({ length: r.buses }, (_, i) => {
      const distance = (geom.length * (i + 0.5)) / r.buses;
      const [lat, lng] = GeoService.pointAt(geom, distance);
      return {
        route: route._id,
        plate: `10-${r.number.padStart(2, "0")}-${String.fromCharCode(65 + i)}${100 + i * 37}`,
        distance,
        direction: i % 2 === 0 ? 1 : -1,
        lat,
        lng,
      };
    });
    await Bus.insertMany(buses);
    console.log(
      `🚏 Xətt ${r.number} (${r.name}): ${r.stops.length} dayanacaq, ${r.buses} avtobus`,
    );
  }
  return true;
};

/**
 * Real-vaxt transit mühərrikini işə salır və servisləri bir-birinə bağlayır.
 */
const startTransit = async () => {
  await bootstrapTransit();
  await fleetService.load();
  analyticsService.init(fleetService);
  demandService.init(fleetService);
  presenceService.init(fleetService);

  // Yeni xəbərdarlıq → dispetçer tövsiyəsi əlavə olunur (operator dərhal görür)
  const attach = (alert, isNew) =>
    isNew ? DispatchService.attachRecommendation(alert) : null;
  analyticsService.onAlert(attach);
  demandService.onAlert(attach);

  // Yeni socket bağlantısına ilkin vəziyyət
  socketService.on("connection", (socket) => {
    socket.emit("buses:update", fleetService.snapshot());
    if (analyticsService.cache)
      socket.emit("crowd:update", analyticsService.cache);
    socket.emit("density:update", presenceService.last);
  });

  fleetService.start();
  analyticsService.start();
  demandService.start();
  presenceService.start();
};

const stopTransit = async () => {
  analyticsService.stop();
  demandService.stop();
  presenceService.stop();
  await fleetService.stop();
};

export {
  bootstrapAdmin,
  bootstrapOperator,
  bootstrapTransit,
  startTransit,
  stopTransit,
};
