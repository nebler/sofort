std.out.puts('FIRST\n');std.out.flush();
std.out.puts('{"t":"ready","v":1}\n');std.out.flush();
JSON.parse(std.in.getline());
std.out.puts('{"t":"call","id":1,"ns":"math","fn":"add","args":[1,1]}\n');std.out.flush();
let r=JSON.parse(std.in.getline());
std.out.puts(JSON.stringify({t:'done',ok:r.ok})+'\n');std.out.flush();
