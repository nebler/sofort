local values={9,1,5,3,5}
table.sort(values)
local sum=0
for _,value in ipairs(values) do sum=sum+value end
assert(#values==5 and values[1]==1 and values[5]==9 and sum==23)
io.write(string.format('{"count":%d,"sum":%d,"max":%d}\n',#values,sum,values[#values]))
