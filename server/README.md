#

Simple long-polling server library built on [Fastify](https://fastify.dev).  
Listens only on `127.0.0.1` — designed to be used as a local IPC transport between processes on the same machine.

## Usage

```js
const LongPoll = require("./longpolling-Lua-NodeJS/server/LongPoll.js");

const lp = new LongPoll(
  [
    { nick: "alice", token: "token-abc-123" },
    { nick: "bob", token: "token-xyz-456" },
  ],
  {
    port: 13921, // default
    routePath: "/longpoll", // default
    checkInterval: 2000, // ms, default
    maxQueueSize: 100, // messages per user, default
  },
);

lp.onMessage(({ nick, object }) => {
  console.log(`Message from ${nick}:`, object);
  lp.send(nick, { type: "echo", data: object });
})
  .onConnectClient((nick) => {
    lp.send(nick, { type: "welcome", text: `Hello, ${nick}!` });
  })
  .onLostClient((nick) => {
    console.log(`${nick} disconnected`);
  });

await lp.start();

// Graceful shutdown
process.on("SIGINT", async () => {
  await lp.stop();
  process.exit(0);
});
```

## API

### `new LongPoll(tokens, options?)`

| Parameter               | Type                   | Description                                   |
| ----------------------- | ---------------------- | --------------------------------------------- |
| `tokens`                | `Array<{nick, token}>` | List of allowed users                         |
| `options.port`          | `number`               | Port to listen on (default: `13921`)          |
| `options.routePath`     | `string`               | Route path (default: `'/longpoll'`)           |
| `options.checkInterval` | `number`               | Heartbeat interval in ms (default: `2000`)    |
| `options.maxQueueSize`  | `number`               | Max queued messages per user (default: `100`) |

### `lp.start()` → `Promise<string>`

Starts the server. Resolves with the address string.

### `lp.stop()` → `Promise<void>`

Stops the heartbeat and closes the server gracefully.

### `lp.send(nick, message)` → `boolean`

Queues a message for a user. Returns `false` if the user doesn't exist or the queue is full.

### `lp.onMessage(handler)` → `this`

Called when a client sends a POST with any `type` other than `checkstatus`/`connect`.  
Handler receives `{ nick: string, object: any }`.

### `lp.onConnectClient(handler)` → `this`

Called when a client POSTs `type: 'connect'`.  
Handler receives `nick: string`.

### `lp.onLostClient(handler)` → `this`

Called when a client stops responding to heartbeats.  
Handler receives `nick: string`.

## HTTP Protocol

All requests must come from `127.0.0.1`.

### `GET /longpoll?token=<token>`

Returns an array of queued messages, or `[]` if none.

### `POST /longpoll?token=<token>`

Body (form-encoded or JSON):

| Field  | Value                                           |
| ------ | ----------------------------------------------- |
| `type` | `'connect'` \| `'checkstatus'` \| anything else |
| `data` | Any payload (passed to `onMessage` as `object`) |

## License

MIT
