/**
 * Test üçün in-memory model qatı — `#models` ilə eyni API (find/findOne/create/... + statics/methods).
 * İnteqrasiya testləri MongoDB tələb etmir: tests/support/hooks.mjs `#models` importunu buraya yönləndirir.
 * Qeyd: Mongoose sxem validasiyası burada işləmir — onu real MongoDB ilə yoxlayın.
 */
import mongoose from "mongoose";
const { Types } = mongoose;
const stores = {};
const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
const eq = (a, b) => String(a) === String(b);
function geo(d, x) {
  if (!d || !d.coordinates) return false;
  const [[lng, lat], r] = x.$centerSphere;
  const t = (v) => (v * Math.PI) / 180;
  const [l2, a2] = d.coordinates;
  const h =
    Math.sin(t(a2 - lat) / 2) ** 2 +
    Math.cos(t(lat)) * Math.cos(t(a2)) * Math.sin(t(l2 - lng) / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(h)) <= r;
}
function match(doc, q) {
  return Object.entries(q).every(([k, v]) => {
    const d = get(doc, k);
    if (
      v &&
      typeof v === "object" &&
      !(v instanceof Date) &&
      !(v instanceof Types.ObjectId) &&
      !Array.isArray(v)
    ) {
      return Object.entries(v).every(([op, x]) =>
        op === "$gte"
          ? d >= x
          : op === "$gt"
            ? d > x
            : op === "$lte"
              ? d <= x
              : op === "$in"
                ? x.some((y) => eq(d, y))
                : op === "$ne"
                  ? !eq(d, x)
                  : op === "$exists"
                    ? (d !== undefined && d !== null) === x
                    : op === "$geoWithin"
                      ? geo(d, x)
                      : true,
      );
    }
    if (Array.isArray(d)) return d.some((y) => eq(y, v));
    return eq(d, v);
  });
}
const POP = { route: "Route", issuedBy: "User", alert: "RouteAlert" };
function doPopulate(obj, spec) {
  const specs = Array.isArray(spec)
    ? spec
    : [typeof spec === "string" ? { path: spec } : spec];
  const o = obj;
  for (const s of specs) {
    const m = POP[s.path];
    if (m && o[s.path]) {
      const ref = stores[m].find((x) => eq(x._id, o[s.path]?._id || o[s.path]));
      if (ref) o[s.path] = plain(ref);
    }
  }
  return o;
}
const plain = (d) => {
  const o = { ...d };
  delete o.save;
  delete o.populate;
  delete o.toObject;
  delete o.transition;
  return JSON.parse(JSON.stringify(o));
};
class Q {
  constructor(name, p, single) {
    this.name = name;
    this.p = p;
    this.single = single;
  }
  sort(s) {
    this.s = s;
    return this;
  }
  limit(n) {
    this.n = n;
    return this;
  }
  lean() {
    this.l = true;
    return this;
  }
  select() {
    return this;
  }
  populate(f) {
    this.pop = f;
    return this;
  }
  then(res, rej) {
    return this.p
      .then((arr) => {
        let a = [...arr];
        if (this.s) {
          const [k, d] = Object.entries(this.s)[0];
          a.sort((x, y) => (get(x, k) > get(y, k) ? 1 : -1) * d);
        }
        if (this.n) a = a.slice(0, this.n);
        let r = this.single ? a[0] || null : a;
        const fix = (x) => {
          if (!x) return x;
          let o = this.l ? plain(x) : x;
          if (this.pop)
            o = doPopulate(this.l ? o : wrapCopy(this.name, x), this.pop);
          return o;
        };
        r = Array.isArray(r) ? r.map(fix) : fix(r);
        return r;
      })
      .then(res, rej);
  }
}
function wrapCopy(name, x) {
  const c = { ...x };
  for (const k of ["save", "populate", "toObject", "transition"])
    if (x[k]) c[k] = x[k];
  return c;
}
function model(name, extra = {}) {
  const store = (stores[name] = []);
  const wrap = (o) => {
    o.toObject = () => plain(o);
    o.save = async () => {
      o.updatedAt = new Date();
      return o;
    };
    o.populate = async (spec) => {
      const c = wrap({ ...o });
      doPopulate(c, spec);
      return c;
    };
    o.id = String(o._id);
    if (extra.methods)
      for (const [k, f] of Object.entries(extra.methods)) o[k] = f.bind(o);
    return o;
  };
  const mk = (d) => {
    const o = {
      ...(extra.defaults ? extra.defaults() : {}),
      ...d,
      _id: d._id || new Types.ObjectId(),
      createdAt: d.createdAt || new Date(),
      updatedAt: new Date(),
    };
    if (o.stops)
      o.stops = o.stops.map((s) => ({
        ...s,
        _id: s._id || new Types.ObjectId(),
      }));
    return wrap(o);
  };
  const M = {
    store,
    find: (q = {}) =>
      new Q(name, Promise.resolve(store.filter((d) => match(d, q)))),
    findOne: (q = {}) =>
      new Q(name, Promise.resolve(store.filter((d) => match(d, q))), true),
    findById: (id) =>
      new Q(name, Promise.resolve(store.filter((d) => eq(d._id, id))), true),
    countDocuments: async (q = {}) => store.filter((d) => match(d, q)).length,
    create: async (d) => {
      const o = mk(d);
      store.push(o);
      return o;
    },
    insertMany: async (a) =>
      a.map((d) => {
        const o = mk(d);
        store.push(o);
        return o;
      }),
    deleteMany: async (q = {}) => {
      const keep = store.filter((d) => !match(d, q));
      const n = store.length - keep.length;
      store.length = 0;
      store.push(...keep);
      return { deletedCount: n };
    },
    deleteOne: async (q) => {
      const i = store.findIndex((d) => match(d, q));
      if (i >= 0) store.splice(i, 1);
    },
    updateOne: async (q, u) => {
      const d = store.find((x) => match(x, q));
      if (d) Object.assign(d, u.$set || u);
    },
    updateMany: async (q, u) => {
      store
        .filter((x) => match(x, q))
        .forEach((d) => Object.assign(d, u.$set || u));
    },
    bulkWrite: async (ops) => {
      for (const op of ops) {
        const d = store.find((x) => match(x, op.updateOne.filter));
        if (d) Object.assign(d, op.updateOne.update.$set);
      }
    },
    findOneAndUpdate: async (q, u) => {
      let d = store.find((x) => match(x, q));
      if (!d) {
        d = mk({ ...q });
        store.push(d);
      }
      Object.assign(d, u.$set || u);
      return d;
    },
    ...(extra.statics || {}),
  };
  if (extra.statics)
    for (const k of Object.keys(extra.statics)) M[k] = extra.statics[k].bind(M);
  return M;
}
export const User = model("User", {
  defaults: () => ({
    status: "active",
    tokenVersion: 0,
    isDeleted: false,
    role: "user",
  }),
});
export const OTP = model("OTP");
export const Route = model("Route", {
  defaults: () => ({ active: true, path: [] }),
  statics: {
    findActive() {
      return this.find({ active: true }).lean();
    },
  },
});
export const Bus = model("Bus", {
  defaults: () => ({ active: true, isReserve: false }),
});
export const DensityReport = model("DensityReport", {
  defaults: () => ({ verified: false, source: "none" }),
  statics: {
    findSince(since, f = {}) {
      return this.find({ ...f, createdAt: { $gte: since } }).lean();
    },
  },
});
export const RouteAlert = model("RouteAlert", {
  defaults: () => ({
    status: "open",
    type: "RESERVE_BUS_NEEDED",
    history: [],
    reserveBuses: [],
    stats: {},
    recommendation: null,
  }),
  statics: {
    findActiveFor(routeId, type) {
      return this.findOne({
        route: routeId,
        type,
        status: { $ne: "resolved" },
      });
    },
  },
  methods: {
    transition(status, note, by, { noteKey, noteParams } = {}) {
      this.status = status;
      if (status === "resolved") this.resolvedAt = new Date();
      this.history.push({
        status,
        note,
        by,
        at: new Date(),
        ...(noteKey ? { noteKey, noteParams } : {}),
      });
      return this;
    },
  },
});
export const TripIntent = model("TripIntent", {
  defaults: () => ({ status: "searched" }),
});
export const DensitySnapshot = model("DensitySnapshot");
export const DispatchCommand = model("DispatchCommand", {
  defaults: () => ({ source: "manual", params: {}, reserveBuses: [] }),
});

/** Bütün kolleksiyaları təmizlə (testlər arası izolyasiya) */
export const resetStores = () => {
  for (const s of Object.values(stores)) s.length = 0;
};
