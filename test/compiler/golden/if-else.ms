{
  declare Integer score = 7;
  declare Text label = "";
  if (score > 10) {
    label = "high";
  } else if (score > 5 && score != 6) {
    label = "mid";
  } else {
    label = "low";
  }
  log(label);
}
