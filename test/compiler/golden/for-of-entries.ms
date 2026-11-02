{
  declare Integer[Text] scores = ["alice" => 3, "bob" => 5];
  declare Integer total = 0;
  foreach (name => score in scores) {
    log(name);
    total += score;
  }
  log("" ^ total);
}
