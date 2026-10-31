/**
 * İnteqrasiya testləri üçün tətbiq: real Express (createApp) + real servislər, in-memory DB.
 * Simulyator və periodik taymerlər işə salınmır — nəticələr deterministikdir.
 */
import { createApp } from "#core/createApp.js";
import {
  bootstrapAdmin,
  bootstrapOperator,
  bootstrapTransit,
  fleetService,
  analyticsService,
  demandService,
  presenceService,
  DispatchService,
  AuthTokenService,
} from "#services";
import { User } from "#models";

let started = null;

export const startTestApp = async () => {
  if (started) return started;
  await bootstrapTransit();
  await fleetService.load();
  analyticsService.init(fleetService);
  demandService.init(fleetService);
  presenceService.init(fleetService);
  const attach = (alert, isNew) =>
    isNew ? DispatchService.attachRecommendation(alert) : null;
  analyticsService.onAlert(attach);
  demandService.onAlert(attach);
  await bootstrapAdmin();
  await bootstrapOperator();

  const { httpServer } = createApp();
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address();
  const base = `http://127.0.0.1:${port}/api`;

  const close = () =>
    new Promise((resolve) => {
      clearTimeout(analyticsService.debounce);
      httpServer.close(() => resolve());
    });

  started = { base, close, httpServer };
  return started;
};

/** JSON sorğusu: { status, body, headers } */
export const api = async (
  base,
  path,
  { method = "GET", body, token, lang, headers = {} } = {},
) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(lang ? { "Accept-Language": lang } : {}),
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json, headers: res.headers };
};

export const login = async (base, email, password) => {
  const r = await api(base, "/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return r.body?.data?.tokens?.accessToken;
};

/** Verilən roldan istifadəçi + access token (login limitinə toxunmadan) */
export const tokenFor = async (role = "user") => {
  const user = await User.create({
    firstName: "Test",
    lastName: role,
    email: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
    password: "x",
    role,
    status: "active",
  });
  return AuthTokenService.generateAccessToken({
    id: String(user._id),
    role: user.role,
    tokenVersion: user.tokenVersion,
  });
};
