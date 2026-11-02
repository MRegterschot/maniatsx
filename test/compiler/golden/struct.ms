#Struct K_Entry {
  Integer count;
  Text name;
}

{
  declare K_Entry e = K_Entry { count = 1, name = "x" };
  declare K_Entry[] list = [e, K_Entry { count = 2, name = "y" }];
  list.add(K_Entry { count = 3, name = "z" });
  log(e.count ^ " " ^ e.name ^ " " ^ list.count);
}
