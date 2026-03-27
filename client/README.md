# client.lua

Lua client for the `longpolling-Lua-NodeJS` server.  
Compatible with SAMP environments (via `lua_thread` / `newTask`) and plain Lua (via `effil`).

## Dependencies

- [effil](https://github.com/effil/effil) — threading
- [encoding](https://github.com/Yonaba/lua-encoding) — CP1251/UTF-8 conversion
- [requests](https://github.com/JakobGreen/lua-requests) — HTTP

In SAMP environments, `addon` and `cjson` are also loaded automatically.

## Usage

```lua
local LongPollClient = require('client')

local client = LongPollClient.new('http://127.0.0.1:13921/longpoll', 'token-abc-123')

client
    :onMessage(function(msg)
        print('Received:', msg.type, msg.data)
    end)
    :start()

-- Send a message to the server
client:send({ text = 'hello' })

-- Stop polling
client:stop()
```

## API

### `LongPollClient.new(url, token, options?)` → `client`

Creates a new client instance.

| Parameter              | Type     | Description                             |
| ---------------------- | -------- | --------------------------------------- |
| `url`                  | `string` | Server URL                              |
| `token`                | `string` | User token                              |
| `options.pollInterval` | `number` | Polling interval in ms (default: `100`) |

---

### `client:onMessage(handler)` → `self`

Registers a handler for incoming messages. Called once per message received from the server, excluding internal ones (`checkstatus`).

```lua
client:onMessage(function(msg)
    -- msg is whatever value the server passed to lp.send()
end)
```

---

### `client:start()` → `self`

Sends `connect` to the server and starts the polling loop in a background thread. Polling begins only after the server acknowledges the connection.

---

### `client:stop()` → `self`

Stops the polling loop. The current in-flight HTTP request will finish before the loop exits.

---

### `client:send(data, callback?)` → `self`

Sends a message to the server with `type = 'message'`.

| Parameter  | Type        | Description                                                    |
| ---------- | ----------- | -------------------------------------------------------------- |
| `data`     | `any`       | Payload — passed as `object` to `onMessage` on the server side |
| `callback` | `function?` | Called after the server responds                               |

## Error Handling

- HTTP errors and network failures are logged via `print('[LP] ...')` and do not interrupt the polling loop.
- If the server returns invalid JSON, the response is silently skipped.
- `checkstatus` is handled automatically and never reaches `onMessage`.
