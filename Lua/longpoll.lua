require('addon')
local cjson = require('cjson')
local effil = require('effil')
local encoding										= require('encoding')
encoding.default									= 'CP1251'
u8 = encoding.UTF8

local M = {}
local eventHandlers = {}

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
    newTask(function()
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

function M.sendPool(url, message, callback)
    asyncHttpRequest('POST', url, {
        headers = {
            ['Content-Type'] = 'application/json'
        },
        data = u8(cjson.encode({
            data = message
        }))
    },
    function(response)
        if response.status_code == 200 then
        else
            print("Catched Error in HTTP Request: "..response.status_code)
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

function M.startPool(url, port, duration)
    if not url then
        url = "http://127.0.0.1/"
    end
    if not port then
        port = "13921"
    end
    if not duration then
        duration = 100
    end
    M.sendPool(url..port, {message = "connected"})
    newTask(function()
        while true do
            wait(duration)
            asyncHttpRequest('GET', url..port, {},
            function(response)
                if response.status_code == 200 then
                    local result = response.text
                    if result ~= "failed" then
                        eventHandlers[#eventHandlers + 1] = result
                        local arrayRequests = cjson.decode(result)

                        for _, request in ipairs(arrayRequests) do
                            if request == "checkstatus" then
                                M.sendPool(url..port, {status = "ok"})
                            else
                                M.onPool(u8:decode(request))
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

function M.onPool(callback)
    for _, handler in ipairs(eventHandlers) do
        callback(handler)
    end
end

return M