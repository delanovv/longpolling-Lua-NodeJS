"use strict";

function getUserByToken(tokens, token) {
  if (!token || !Array.isArray(tokens)) return false;
  const user = tokens.find((u) => u.token === token);
  return user ? user.nick : false;
}

function isLocalRequest(ip) {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

module.exports = { getUserByToken, isLocalRequest };
