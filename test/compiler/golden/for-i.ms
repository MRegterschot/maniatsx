{
  declare Integer a = 2;
  declare Integer b = 6;
  declare Integer sum = 0;
  for (i, a, b - 1) {
    sum += i;
  }
  for (j, 0, 3) {
    sum += j;
  }
  log("" ^ sum);
}
