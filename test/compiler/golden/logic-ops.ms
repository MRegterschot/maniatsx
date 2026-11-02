{
  declare Integer a = 1;
  declare Integer b = 2;
  declare Text t = "x";
  declare Boolean p = a == b;
  declare Boolean q = a != b;
  declare Boolean r = a < b && t == "x" || !(a >= b);
  declare Boolean s = !p && (q || r);
  declare Boolean u = a == 1 && (b == 2 || t != "y");
  log(p ^ " " ^ q ^ " " ^ r ^ " " ^ s ^ " " ^ u);
}
