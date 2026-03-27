local effil    = require('effil')
local encoding = require('encoding')
encoding.default = 'CP1251'
u8 = encoding.UTF8

local thread
if type(encodeJson) == 'nil' then
    require('addon')
    local cjson = require('cjson')
    function encodeJson(...) return cjson.encode(...) end
    function decodeJson(...) return cjson.decode(...) end
    thread = function(...) return newTask(...) end
else
    thread = function(...) return lua_thread.create(...) end
end

local function asyncHttpRequest(method, url, args, resolve, reject)
    resolve = resolve or function() end
    reject  = reject  or function() end

    local req = effil.thread(function(method, url, args)
        local requests = require('requests')
        local ok, response = pcall(requests.request, method, url, args)
        if ok then
            response.json, response.xml = nil, nil
            return true, response
        else
            return false, response
        end
    end)(method, url, args)

    thread(function()
        while true do
            local status, err = req:status()
            if err then
                return reject(err)
            elseif status == 'completed' then
                local ok, response = req:get()
                if ok then resolve(response) else reject(response) end
                return
            elseif status == 'canceled' then
                return reject('canceled')
            end
            wait(0)
        end
    end)
end

local LongPollClient = {}
LongPollClient.__index = LongPollClient

function LongPollClient.new(url, token, options)
    assert(type(url)   == 'string', 'url must be a string')
    assert(type(token) == 'string', 'token must be a string')
    options = options or {}

    return setmetatable({
        url          = url,
        token        = token,
        pollInterval = options.pollInterval or 100,
        _handler     = nil,
        _running     = false,
    }, LongPollClient)
end

function LongPollClient:onMessage(handler)
    assert(type(handler) == 'function', 'handler must be a function')
    self._handler = handler
    return self
end

function LongPollClient:_post(msgType, data, callback)
    asyncHttpRequest('POST', self.url .. '?token=' .. self.token, {
        headers = { ['Content-Type'] = 'application/json' },
        data    = u8(encodeJson({ type = msgType, data = data or {} })),
    }, callback, function(err)
        print('[LP] POST error: ' .. tostring(err))
    end)
end

function LongPollClient:_poll()
    asyncHttpRequest('GET', self.url .. '?token=' .. self.token, {},
    function(response)
        if response.status_code ~= 200 then
            print('[LP] HTTP ' .. tostring(response.status_code) .. ': ' .. tostring(response.text))
            return
        end

        local ok, messages = pcall(decodeJson, response.text)
        if not ok or type(messages) ~= 'table' then return end

        for _, msg in ipairs(messages) do
            if msg == 'checkstatus' then
                self:_post('checkstatus')
            elseif self._handler then
                self._handler(msg)
            end
        end
    end,
    function(err)
        print('[LP] GET error: ' .. tostring(err))
    end)
end

function LongPollClient:start()
    if self._running then return end
    self._running = true

    self:_post('connect', {}, function()
        thread(function()
            while self._running do
                wait(self.pollInterval)
                self:_poll()
            end
        end)
    end)

    return self
end

function LongPollClient:stop()
    self._running = false
    return self
end

function LongPollClient:send(data, callback)
    self:_post('message', data, callback)
    return self
end

return LongPollClient