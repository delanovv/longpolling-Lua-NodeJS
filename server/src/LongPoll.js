"use strict";

const Fastify = require("fastify");
const { getUserByToken, isLocalRequest } = require("./utils");

const DEFAULT_OPTIONS = {
  port: 13921,
  routePath: "/longpoll",
  checkInterval: 2000,
  maxQueueSize: 100,
};

class LongPoll {
  constructor(tokens = [], options = {}) {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      throw new Error("tokens must be a non-empty array");
    }

    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.tokens = tokens;

    this.fastify = Fastify({ logger: false });
    this.fastify.register(require("@fastify/formbody"));

    this.users = new Map(
      tokens.map(({ nick, token }) => [
        nick,
        {
          nick,
          token,
          alive: true,
          lost: false,
          messages: [],
        },
      ]),
    );

    this._onMessage = ({ object, nick }) => {
      console.warn(
        `[LongPoll] onMessage not set. Received from ${nick}:`,
        object,
      );
    };
    this._onLost = (nick) => {
      console.warn(`[LongPoll] onLostClient not set. Lost: ${nick}`);
    };
    this._onConnect = (nick) => {
      console.warn(`[LongPoll] onConnectClient not set. Connected: ${nick}`);
    };

    this._checkTimer = null;
  }

  onMessage(handler) {
    if (typeof handler !== "function")
      throw new TypeError("handler must be a function");
    this._onMessage = handler;
    return this;
  }

  onLostClient(handler) {
    if (typeof handler !== "function")
      throw new TypeError("handler must be a function");
    this._onLost = handler;
    return this;
  }

  onConnectClient(handler) {
    if (typeof handler !== "function")
      throw new TypeError("handler must be a function");
    this._onConnect = handler;
    return this;
  }

  send(nick, message) {
    const user = this.users.get(nick);
    if (!user) return false;

    if (user.messages.length >= this.options.maxQueueSize) {
      console.warn(
        `[LongPoll] Queue overflow for user "${nick}". Message dropped.`,
      );
      return false;
    }

    if (message === "checkstatus" && user.messages.includes("checkstatus")) {
      return false;
    }

    user.messages.push(message);
    return true;
  }

  sendLongPoll(nick, message) {
    return this.send(nick, message);
  }

  async start() {
    this._registerRoutes();
    this._startHeartbeat();

    const address = await this.fastify.listen({
      port: this.options.port,
      host: "127.0.0.1",
    });

    console.log(`[LongPoll] Listening on ${address}`);
    return address;
  }

  async stop() {
    if (this._checkTimer) {
      clearTimeout(this._checkTimer);
      this._checkTimer = null;
    }
    await this.fastify.close();
    console.log("[LongPoll] Server stopped.");
  }

  _getUserByToken(token) {
    return getUserByToken(this.tokens, token);
  }

  _registerRoutes() {
    const { routePath } = this.options;

    this.fastify.get(routePath, (req, reply) => {
      const nick = this._getUserByToken(req.query.token);
      if (!nick) return reply.code(403).send({ error: "Invalid token" });

      const user = this.users.get(nick);
      if (user.messages.length > 0) {
        const msgs = user.messages.splice(0);
        return reply.send(msgs);
      }

      return reply.send([]);
    });

    this.fastify.post(routePath, (req, reply) => {
      const nick = this._getUserByToken(req.query.token);
      if (!nick) return reply.code(403).send({ error: "Invalid token" });

      const { type, data } = req.body ?? {};
      if (!type) return reply.code(400).send({ error: "Missing type" });

      const user = this.users.get(nick);
      if (!user) return reply.code(403).send({ error: "User not found" });

      switch (type) {
        case "checkstatus":
          user.alive = true;
          user.lost = false;
          break;

        case "connect":
          user.alive = true;
          user.lost = false;
          this._onConnect(nick);
          break;

        default:
          this._onMessage({ object: data, nick });
          break;
      }

      return reply.code(200).send({ ok: true });
    });
  }

  _startHeartbeat() {
    const tick = () => {
      for (const user of this.users.values()) {
        this.send(user.nick, "checkstatus");

        if (!user.alive && !user.lost) {
          user.lost = true;
          this._onLost(user.nick);
        }

        user.alive = false;
      }

      this._checkTimer = setTimeout(tick, this.options.checkInterval);
    };

    this._checkTimer = setTimeout(tick, this.options.checkInterval);
  }
}

module.exports = LongPoll;
