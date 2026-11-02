{
  declare Integer n = 0;
  while (n < 10) {
    n += 1;
    if (n == 3) {
      continue;
    }
    if (n == 8) {
      break;
    }
    log("" ^ n);
  }
}
