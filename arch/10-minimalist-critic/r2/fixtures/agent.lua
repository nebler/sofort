-- Deterministic code-mode-shaped data transformation, loaded as a script file.
local input = io.read('*a')
local values, sum = {}, 0
for number in input:gmatch('%d+') do
  local n = tonumber(number)
  values[#values + 1] = n
  sum = sum + n
end
table.sort(values)
assert(#values == 5 and values[1] == 1 and values[5] == 9 and sum == 23)
io.write(string.format('{"count":%d,"sum":%d,"max":%d}\n', #values, sum, values[#values]))
