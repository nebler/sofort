local function out(...)
  local t = table.pack(...)
  for i = 1, t.n do t[i] = tostring(t[i]):gsub('[^ -~]', function(c) return ('\\%d'):format(c:byte()) end) end
  io.write(table.concat(t, ' ', 1, t.n), '\n')
end
-- Lua stdlib file access against the read-only archive (no directory API in Lua).
local f = assert(io.open('/skills/readme.md')); local s = f:read('a'); f:close()
out(#s, s)
out(dofile('/scripts/x.lua'))
out(loadfile('/scripts/x.lua')())
package.path = '/modules/?.lua;/modules/?/init.lua'
out(require('mymod').f(), require('pkg').name)
local lines = {}
for line in io.lines('/skills/readme.md') do lines[#lines + 1] = '[' .. line .. ']' end
out(table.concat(lines))
local g = io.open('/skills/readme.md'); out(g:seek('set', 2), g:read(4), g:seek('cur'), g:seek('end')); g:close()
local b = io.open('/data/big.bin', 'rb'); local bytes = b:read('a'); out(#bytes, bytes:byte(1, 4)); b:close()
out(io.open('/nope'))
out(io.open('/skills/readme.md', 'w'))
out(io.open('/skills/new.txt', 'a'))
local d = io.open('/skills'); out(d:read('a')); d:close()
out(pcall(dofile, '/nope.lua'))
out(pcall(require, 'missing'))
