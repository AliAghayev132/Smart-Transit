import { SocketServer, jwt } from "#lib";
import { config, corsConfig } from "#config";
import { operatorRoles } from "#constants";

/**
 * SocketService (singleton)
 *
 * Ümumi "room" qatı + Smart Transit real-vaxt kanalları.
 *
 * Sərnişinlər anonimdir, ona görə token olmadan "guest"
 * bağlantısına icazə verilir. Token göndərilibsə doğrulanır; operator/admin
 * avtomatik `operators` otağına qoşulur və yalnız orada operator hadisələrini alır.
 *
 * Client → server:
 *   join:room, leave:room, typing:*, message:new   (ümumi otaqlar)
 *   presence:update {lat,lng,accuracy,speed}        (Yanaşma B — canlı lokasiya)
 *   presence:stop
 *
 * Server → client:
 *   buses:update, crowd:update, density:update, report:new, demand:changed   (hamıya)
 *   alert:new, alert:update, dispatch:new                                     (operators)
 */
const OPERATORS_ROOM = "operators";

const MAX_PRESENCE_PER_IP = 3;

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // Map<roomId, Set<socketId>>
    this.socketToUser = new Map(); // Map<socketId, { id, roomId }>
    this.handlers = {
      presenceUpdate: null,
      presenceStop: null,
      connection: null,
    };
    this.presenceByIp = new Map();
  }

  /**
   * Initialize Socket.IO with the HTTP server
   */
  init(httpServer) {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: corsConfig.origin,
        methods: ["GET", "POST"],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.io.use(this.authMiddleware.bind(this));
    this.setupEventHandlers();

    return this.io;
  }

  /**
   * Token varsa doğrulayır; yoxdursa "guest" kimi buraxır.
   */
  async authMiddleware(socket, next) {
    const token = socket.handshake.auth?.token;

    if (!token) {
      socket.userId = null;
      socket.userRole = "guest";
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.accessSecretKey);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.user = decoded;
      next();
    } catch (_error) {
      return next(new Error("Invalid token"));
    }
  }

  isOperator(socket) {
    return operatorRoles.includes(socket.userRole);
  }

  /**
   * Servislər öz handler-lərini qeyd edir (dövri import olmadan)
   */
  on(name, fn) {
    this.handlers[name] = fn;
  }

  /**
   * Register Socket.IO event handlers
   */
  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      if (this.isOperator(socket)) socket.join(`room:${OPERATORS_ROOM}`);

      // İlkin vəziyyəti göndər (avtobuslar, sıxlıq...)
      this.handlers.connection?.(socket);

      // Rooms (ümumi)
      socket.on("join:room", (roomId) => {
        if (roomId === OPERATORS_ROOM && !this.isOperator(socket)) return;
        this.joinRoom(socket, roomId);
      });
      socket.on("leave:room", (roomId) => this.leaveRoom(socket, roomId));

      socket.on("typing:start", (roomId) => {
        socket
          .to(`room:${roomId}`)
          .emit("user:typing", { roomId, userId: socket.userId });
      });
      socket.on("typing:stop", (roomId) => {
        socket
          .to(`room:${roomId}`)
          .emit("user:stopped_typing", { roomId, userId: socket.userId });
      });
      socket.on("message:new", ({ roomId, message }) => {
        if (!socket.userId) return; // qonaqlar mesaj yaza bilməz
        this.io.to(`room:${roomId}`).emit("message:new", {
          roomId,
          message,
          userId: socket.userId,
          sentAt: new Date(),
        });
      });

      // Yanaşma B — canlı lokasiya (açar = anonim socket.id)
      socket.on("presence:update", (p) => {
        if (!this.allowPresence(socket)) return;
        this.handlers.presenceUpdate?.(socket.id, p);
      });
      socket.on("presence:stop", () => {
        this.releasePresence(socket);
        this.handlers.presenceStop?.(socket.id);
      });

      socket.on("disconnect", () => {
        this.releasePresence(socket);
        this.handlers.presenceStop?.(socket.id);
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Yanaşma B — bir şəbəkə mənbəyindən (IP) ən çox MAX_PRESENCE_PER_IP canlı mövqe qəbul olunur:
   * çoxlu socket açıb «canlı sərnişin» sayını şişirtmək olmasın.
   */
  allowPresence(socket) {
    const ip = socket.handshake?.address || "unknown";
    const set = this.presenceByIp.get(ip) || new Set();
    if (!set.has(socket.id) && set.size >= MAX_PRESENCE_PER_IP) return false;
    set.add(socket.id);
    this.presenceByIp.set(ip, set);
    return true;
  }

  releasePresence(socket) {
    const ip = socket.handshake?.address || "unknown";
    const set = this.presenceByIp.get(ip);
    if (!set) return;
    set.delete(socket.id);
    if (!set.size) this.presenceByIp.delete(ip);
  }

  joinRoom(socket, roomId) {
    const roomName = `room:${roomId}`;
    socket.join(roomName);

    if (!this.connectedUsers.has(roomId)) {
      this.connectedUsers.set(roomId, new Set());
    }
    this.connectedUsers.get(roomId).add(socket.id);
    this.socketToUser.set(socket.id, { id: socket.userId, roomId });

    socket.to(roomName).emit("user:joined", { roomId, userId: socket.userId });
  }

  leaveRoom(socket, roomId) {
    const roomName = `room:${roomId}`;
    socket.leave(roomName);

    if (this.connectedUsers.has(roomId)) {
      this.connectedUsers.get(roomId).delete(socket.id);
      if (this.connectedUsers.get(roomId).size === 0) {
        this.connectedUsers.delete(roomId);
      }
    }
    this.socketToUser.delete(socket.id);

    socket.to(roomName).emit("user:left", { roomId, userId: socket.userId });
  }

  handleDisconnect(socket) {
    const info = this.socketToUser.get(socket.id);
    if (info) this.leaveRoom(socket, info.roomId);
  }

  /** Hamıya (sərnişin + operator). volatile: itə bilər (tez-tez yenilənən data) */
  broadcast(event, data, { volatile = false } = {}) {
    if (!this.io) return;
    (volatile ? this.io.volatile : this.io).emit(event, data);
  }

  /** Yalnız operator/admin bağlantılarına */
  toOperators(event, data) {
    this.emitToRoom(OPERATORS_ROOM, event, data);
  }

  emitToRoom(roomId, event, data) {
    if (!this.io) return;
    this.io.to(`room:${roomId}`).emit(event, data);
  }

  emitToUser(userId, event, data) {
    if (!this.io) return;
    for (const [socketId, info] of this.socketToUser.entries()) {
      if (info.id === userId) this.io.to(socketId).emit(event, data);
    }
  }

  getIO() {
    return this.io;
  }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;
