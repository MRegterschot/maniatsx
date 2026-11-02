{
  declare Text name = "world";
  declare Integer n = 3;
  declare Real r = 1.5;
  declare Text a = "hello " ^ name;
  declare Text b = "n=" ^ n ^ ", r=" ^ r;
  declare Text c = "hi " ^ name ^ ", you have " ^ n ^ " items at " ^ r;
  declare Text d = "" ^ n;
  declare Text e = n ^ " items";
  log(a ^ " " ^ b ^ " " ^ c ^ " " ^ d ^ " " ^ e);
}
