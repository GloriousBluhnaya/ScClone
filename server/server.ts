
import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

interface ShipState {
  id: string;
  callsign: string;
  slot: number; // 0 or 1
  isControlled: boolean;
  position: Vector3;
  velocity: Vector3;
  rotation: Quaternion;
  angularVelocity: Vector3;
  throttle: number;
  boost: boolean;
  decoupled: boolean;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  score: number;
  lastHit: number;
}

interface Room {
  id: string;
  ships: [ShipState, ShipState];
  clients: Map<string, WebSocket>; // playerId -> ws
}

function parseVector3(val: any, fallback: Vector3 = { x: 0, y: 0, z: 0 }): Vector3 {
  if (!val) return { ...fallback };
  if (Array.isArray(val)) {
    return {
      x: typeof val[0] === "number" && !isNaN(val[0]) ? val[0] : fallback.x,
      y: typeof val[1] === "number" && !isNaN(val[1]) ? val[1] : fallback.y,
      z: typeof val[2] === "number" && !isNaN(val[2]) ? val[2] : fallback.z,
    };
  }
  return {
    x: typeof val.x === "number" && !isNaN(val.x) ? val.x : fallback.x,
    y: typeof val.y === "number" && !isNaN(val.y) ? val.y : fallback.y,
    z: typeof val.z === "number" && !isNaN(val.z) ? val.z : fallback.z,
  };
}

function parseQuaternion(val: any, fallback: Quaternion = { x: 0, y: 0, z: 0, w: 1 }): Quaternion {
  if (!val) return { ...fallback };
  if (Array.isArray(val)) {
    return {
      x: typeof val[0] === "number" && !isNaN(val[0]) ? val[0] : fallback.x,
      y: typeof val[1] === "number" && !isNaN(val[1]) ? val[1] : fallback.y,
      z: typeof val[2] === "number" && !isNaN(val[2]) ? val[2] : fallback.z,
      w: typeof val[3] === "number" && !isNaN(val[3]) ? val[3] : fallback.w,
    };
  }
  return {
    x: typeof val.x === "number" && !isNaN(val.x) ? val.x : fallback.x,
    y: typeof val.y === "number" && !isNaN(val.y) ? val.y : fallback.y,
    z: typeof val.z === "number" && !isNaN(val.z) ? val.z : fallback.z,
    w: typeof val.w === "number" && !isNaN(val.w) ? val.w : fallback.w,
  };
}

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

const rooms = new Map<string, Room>();

function createDefaultShips(): [ShipState, ShipState] {
  return [
    {
      id: "ship-1",
      callsign: "GLADIUS-ALPHA",
      slot: 0,
      isControlled: false,
      position: { x: -200, y: 0, z: -400 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0.7071, z: 0, w: 0.7071 }, // Facing +X
      angularVelocity: { x: 0, y: 0, z: 0 },
      throttle: 0,
      boost: false,
      decoupled: false,
      hull: 100,
      maxHull: 100,
      shield: 100,
      maxShield: 100,
      score: 0,
      lastHit: 0,
    },
    {
      id: "ship-2",
      callsign: "GLADIUS-BRAVO",
      slot: 1,
      isControlled: false,
      position: { x: 200, y: 0, z: -400 },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: -0.7071, z: 0, w: 0.7071 }, // Facing -X
      angularVelocity: { x: 0, y: 0, z: 0 },
      throttle: 0,
      boost: false,
      decoupled: false,
      hull: 100,
      maxHull: 100,
      shield: 100,
      maxShield: 100,
      score: 0,
      lastHit: 0,
    },
  ];
}

function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      ships: createDefaultShips(),
      clients: new Map(),
    };
    rooms.set(roomId, room);
  }
  return room;
}

function broadcastToRoom(room: Room, msg: object, excludeWs?: WebSocket) {
  const data = JSON.stringify(msg);
  room.clients.forEach((ws) => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

// WebSocket Server with explicit HTTP upgrade handling
const wss = new WebSocket

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws: WebSocket, req) => {
  const urlObj = new URL(req.url || "/", "http://localhost");
  const roomId = urlObj.searchParams.get("room") || "arena-1";
  const room = getOrCreateRoom(roomId);

  // Clean up any stale or non-OPEN sockets in room before assigning slot
  room.ships.forEach((s) => {
    const existingWs = room.clients.get(s.id);
    if (!existingWs || existingWs.readyState !== WebSocket.OPEN) {
      s.isControlled = false;
      if (existingWs) room.clients.delete(s.id);
    }
  });

  // Assign slot: pick first uncontrolled ship slot
  let slot = room.ships.findIndex((s) => !s.isControlled);
  if (slot === -1) {
    slot = 1;
  }

  const assignedShip = room.ships[slot];
  assignedShip.isControlled = true;
  const playerId = assignedShip.id;

  room.clients.set(playerId, ws);

  // Send init payload directly
  ws.send(
    JSON.stringify({
      type: "init",
      roomId: room.id,
      playerId,
      slot,
      ships: room.ships,
    })
  );

  // Broadcast snapshot to all room clients
  broadcastToRoom(room, {
    type: "arena:snapshot",
    ships: room.ships,
  });

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", t: data.t }));
      } else if (data.type === "player:update") {
        const ship = room.ships[slot];
        if (ship) {
          ship.position = parseVector3(data.position, ship.position);
          ship.velocity = parseVector3(data.velocity, ship.velocity);
          ship.rotation = parseQuaternion(data.rotation, ship.rotation);
          ship.angularVelocity = parseVector3(data.angularVelocity, ship.angularVelocity);
          ship.throttle = typeof data.throttle === "number" ? data.throttle : ship.throttle;
          ship.boost = Boolean(data.boost);
          ship.decoupled = Boolean(data.decoupled);
          ship.lastHit = Date.now();

          // Instant zero-wait packet relay to opponents in same room
          broadcastToRoom(room, {
            type: "ship:sync",
            ship,
            timestamp: Date.now(),
          }, ws);
        }
      } else if (data.type === "player:callsign") {
        const ship = room.ships[slot];
        if (ship && typeof data.callsign === "string") {
          ship.callsign = data.callsign.trim().substring(0, 18) || `GLADIUS-${slot + 1}`;
          broadcastToRoom(room, {
            type: "arena:snapshot",
            ships: room.ships,
          });
        }
      } else if (data.type === "weapon:fire") {
        const origin = parseVector3(data.origin);
        const velocity = parseVector3(data.velocity);

        broadcastToRoom(room, {
          type: "weapon:fired",
          laser: {
            id: "lzr-" + Math.random().toString(36).substring(2, 9),
            shooterId: playerId,
            origin: [origin.x, origin.y, origin.z],
            velocity: [velocity.x, velocity.y, velocity.z],
            color: data.color || "#00f0ff",
            timestamp: Date.now(),
          },
        });
      } else if (data.type === "combat:hit") {
        const targetShip = room.ships.find((s) => s.id === data.targetId);
        if (targetShip) {
          const damage = typeof data.damage === "number" ? data.damage : 15;
          let remaining = damage;

          if (targetShip.shield > 0) {
            if (targetShip.shield >= remaining) {
              targetShip.shield -= remaining;
              remaining = 0;
            } else {
              remaining -= targetShip.shield;
              targetShip.shield = 0;
            }
          }

          if (remaining > 0) {
            targetShip.hull = Math.max(0, targetShip.hull - remaining);
          }

          targetShip.lastHit = Date.now();
          const destroyed = targetShip.hull <= 0;

          if (destroyed) {
            const shooterShip = room.ships[slot];
            if (shooterShip) {
              shooterShip.score += 1;
            }
          }

          broadcastToRoom(room, {
            type: "combat:damaged",
            targetId: data.targetId,
            shield: targetShip.shield,
            hull: targetShip.hull,
            hitPoint: parseVector3(data.hitPoint),
            shooterId: playerId,
            destroyed,
            ships: room.ships,
          });

          if (destroyed) {
            setTimeout(() => {
              targetShip.hull = targetShip.maxHull;
              targetShip.shield = targetShip.maxShield;
              targetShip.position =
                targetShip.slot === 0
                  ? { x: -200, y: 0, z: -400 }
                  : { x: 200, y: 0, z: -400 };
              targetShip.velocity = { x: 0, y: 0, z: 0 };
              broadcastToRoom(room, {
                type: "ship:respawned",
                ship: targetShip,
                ships: room.ships,
              });
            }, 2500);
          }
        }
      }
    } catch (e) {
      console.error("Error processing ws message:", e);
    }
  });

  ws.on("close", () => {
    room.clients.delete(playerId);
    assignedShip.isControlled = false;
    broadcastToRoom(room, {
      type: "arena:snapshot",
      ships: room.ships,
    });

    if (room.clients.size === 0) {
      rooms.delete(roomId);
    }
  });
});

// 25Hz Periodic arena snapshot sync per room
setInterval(() => {
  if (rooms.size === 0) return;
  rooms.forEach((room) => {
    if (room.clients.size === 0) return;
    broadcastToRoom(room, {
      type: "arena:snapshot",
      ships: room.ships,
      timestamp: Date.now(),
    });
  });
}, 40);

// API Endpoints
app.get("/api/health", (_req, res) => {
  let totalPilots = 0;
  rooms.forEach((r) => (totalPilots += r.clients.size));
  res.json({
    status: "ok",
    roomsCount: rooms.size,
    pilotsOnline: totalPilots,
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Star Citizen 1v1 Browser Duel Server running on port ${PORT}`);
  });
}

startServer();
