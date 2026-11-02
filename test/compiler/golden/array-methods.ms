{
  declare Integer[] items = [4, 5, 6];
  items.add(7);
  declare Integer total = items.count;
  declare Boolean has = items.exists(5);
  declare Integer at = items.keyof(6);
  items.removekey(0);
  declare Text[] names = ["a", "b"];
  names.add("c");
  declare Integer[Text] scores = ["a" => 1, "b" => 2];
  declare Text[] Mtx_T0;
  foreach (Mtx_T0_K => Mtx_T0_V in scores) {
    Mtx_T0.add(Mtx_T0_K);
  }
  foreach (k in Mtx_T0) {
    log(k);
  }
  log(total ^ " " ^ has ^ " " ^ at ^ " " ^ names.count);
}
