local effil = require('effil') 
local encoding										= require('encoding'); encoding.default									= 'CP1251'; u8 = encoding.UTF8

local M = {}
local eventHandlers = {}

local thread = function() end

if type(encodeJson) == 'nil' then
  require('addon')
  local cjson = require('cjson')

  function encodeJson(...) return cjson.encode(...) end
  function decodeJson(...) return cjson.decode(...) end
  function thread(...) return newTask(...) end
else
  function thread(...) return lua_thread.create(...) end
end


function asyncHttpRequest(method, url, args, resolve, reject)
    local request_thread = effil.thread(function (method, url, args)
        local requests = require 'requests'
        local result, response = pcall(requests.request, method, url, args)
        if result then
            response.json, response.xml = nil, nil
            return true, response
        else
            return false, response
        end
    end)(method, url, args)
    -- Если запрос без функций обработки ответа и ошибок.
    if not resolve then resolve = function() end end
    if not reject then reject = function() end end
    -- Проверка выполнения потока
    thread(function()
        local runner = request_thread
        while true do
            local status, err = runner:status()
            if not err then
                if status == 'completed' then
                    local result, response = runner:get()
                    if result then
                        resolve(response)
                    else
                        reject(response)
                    end
                    return
                elseif status == 'canceled' then
                    return reject(status)
                end
            else
                return reject(err)
            end
            wait(0)
        end
    end)
end

function M.sendPoll(url, token, message, callback, reqType)
    reqType = reqType or "message"
    asyncHttpRequest('POST', url.."?token="..token, {
        headers = {
            ['Content-Type'] = 'application/json'
        },
        data = u8(encodeJson({
            data = message,
            type = reqType
        })),
    },
    function(response)
        if response.status_code == 200 then
        else
            print("Catched Error in HTTP Request: "..response.text)
        end
        if type(callback) == "function" then
            callback(response)
        end
    end,
    function(err)
        print("Ошибка: " .. err)
    end
)
end

function M.startPoll(url, token, duration)
    url = url or 'http://127.0.0.1:13921/longpoll'
    duration = duration or 100
    M.sendPoll(url, token, {}, function() end, "connect")
    thread(function()
        while true do
            wait(duration)
            asyncHttpRequest('GET', url.."?token="..token, {},
            function(response)
                if response.status_code == 200 then
                    local result = response.text
                    if result ~= "failed" then
                        eventHandlers[#eventHandlers + 1] = result
                        local arrayRequests = decodeJson(result)
                        for _, request in ipairs(arrayRequests) do
                            if request == "checkstatus" then
                                M.sendPoll(url, token, {}, function() end, "checkstatus")
                            else
                                M.onPoll(request)
                            end
                        end
                    end
                else
                    print('[LP] Ошибка: HTTP код: ' .. tostring(response.status_code))
                    print('[LP] Текст ошибки: ' .. tostring(response.text))
                end
            end,
            function(err)
                print('[LP] Ошибка: ' .. tostring(err))
            end
            )
        end
    end)
end

function M.onPoll(callback)
    for _, handler in ipairs(eventHandlers) do
        callback(handler)
    end
end

return M