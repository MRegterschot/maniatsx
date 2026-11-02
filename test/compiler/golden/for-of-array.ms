{
  declare Integer[] values = [1, 2, 3];
  declare Integer sum = 0;
  foreach (x in values) {
    sum += x;
  }
  log("" ^ sum);
}
