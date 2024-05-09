const express = require('express');

const app = express();
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

let status = true;

class LongPoll {
  constructor(port = 13921, routePath = 'longpoll') {
    this.port = port;
    this.routePath = routePath;
    this.messages = [];
  }

  initialize() {
    app.get(this.routePath, (req, res) => {
      if (this.messages.length > 0) {
        res.send(this.messages);
        this.messages = [];
      } else {
        res.send('failed');
      }
    });

    app.post(this.routePath, (req, res) => {
      if (req.body.data.status) {
        status = true;
      } else if (req.body.data.message === 'connected') {
        this.handlerConnect();
      } else {
        this.messageHandler(req.body.data);
      }
      res.sendStatus(200);
    });

    setInterval(() => {
      this.messages.push('checkstatus');
      if (status === false) {
        this.handlerLost();
      }
      status = false;
    }, 5000);

    app.listen(this.port, () => {});
  }

  onMessage(handler) {
    this.messageHandler = handler;
  }

  sendLongPool(longpoolmessage) {
    if (this.messages.length === 0) {
      this.messages.push(longpoolmessage);
    } else {
      this.messages.push(longpoolmessage);
    }
  }

  onLostClient(handler) {
    this.handlerLost = handler;
  }

  onConnectClient(handler) {
    this.handlerConnect = handler;
  }
}

module.exports = LongPoll;
