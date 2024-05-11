const fastify = require('fastify')({ logger: false });

fastify.register(require('@fastify/formbody'));

class LongPoll {
  constructor(port = 13921, routePath = '/longpoll', tokens = {}) {
    this.port = port;
    this.routePath = routePath;
    this.tokens = tokens;
    this.usersList = tokens.map(({ nick, token }) => ({
      nick,
      token,
      status: true,
      clientLost: false,
      messages: [],
    }));
  }

  initialize(callback) {
    fastify.get(this.routePath, (req, reply) => {
      const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1';
      if (!isLocalhost) {
        reply.code(403).send('Access denied');
        return;
      }
      const token = req.query.token;
      if (!token || !getUser(this.tokens, token)) {
        console.log(req.query);
        return reply.code(403).send('Invalid Token');
      }

      const userMessages = this.usersList.find(user => user.token === token);
      if (userMessages && userMessages.messages.length > 0) {
        reply.send(userMessages.messages);
        userMessages.messages = [];
      } else {
        reply.send('failed');
      }
    });

    fastify.post(this.routePath, (req, reply) => {
      const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1';
      if (!isLocalhost) {
        reply.code(403).send('Access denied');
        return;
      }
      const user = getUser(this.tokens, req.query.token) || false;
      if (!user) {
        return reply.code(403).send('Invalid Token');
      }
      if (!req.body.type) {
        return reply.code(403).send('Invalid Type');
      }

      const currentUser = this.usersList.find(u => u.nick === user);
      if (!currentUser) {
        return reply.code(403).send('Invalid User');
      }

      if (req.body.type === 'checkstatus') {
        currentUser.status = true;
        currentUser.clientLost = false;
      } else if (req.body.type === 'connect') {
        this.handlerConnect(user);
      } else {
        this.messageHandler({ object: req.body.data, nick: user });
      }
      reply.code(200).send();
    });

    const checkStatus = () => {
      this.usersList.forEach(user => {
        if (!user.messages.includes('checkstatus')) {
          user.messages.push('checkstatus');
        }
        if (user.status === false && !user.clientLost) {
          this.handlerLost(user.nick);
          user.clientLost = true;
        }
        user.status = false;
      });
      setTimeout(checkStatus, 2000);
    };
    checkStatus();

    fastify.listen({ port: this.port, host: '0.0.0.0' }, (err, address) => {
      if (typeof callback === 'function') {
        callback();
      }
      if (err) {
        console.error(err);
        process.exit(1);
      }
    });
  }

  onMessage(handler) {
    this.messageHandler = handler;
  }

  sendLongPoll(name, longpollmessage) {
    const user = this.usersList.find(user => user.nick === name);
    if (user) {
      user.messages.push(longpollmessage);
    }
  }

  onLostClient(handler) {
    this.handlerLost = handler;
  }

  onConnectClient(handler) {
    this.handlerConnect = handler;
  }
}

function getUser(tokens, token) {
  const user = tokens.find(user => user.token === token);
  return user ? user.nick : false;
}

module.exports = LongPoll;
