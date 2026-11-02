{
  declare Integer n = 5;
  declare Integer Mtx_T0;
  if (n > 3) {
    Mtx_T0 = 10;
  } else {
    Mtx_T0 = 1;
  }
  declare Integer big = Mtx_T0;
  declare Real Mtx_T1;
  if (n > 3) {
    Mtx_T1 = 0.5;
  } else {
    Mtx_T1 = 1.5;
  }
  declare Real half = Mtx_T1;
  declare Text Mtx_T2;
  if (n == 5) {
    Mtx_T2 = "five";
  } else {
    Mtx_T2 = "other";
  }
  declare Text word = Mtx_T2;
  declare CMlLabel label <=> (Page.GetFirstChild("a") as CMlLabel);
  declare CMlLabel other <=> (Page.GetFirstChild("b") as CMlLabel);
  declare CMlLabel Mtx_T3;
  if (n > 3) {
    Mtx_T3 <=> label;
  } else {
    Mtx_T3 <=> other;
  }
  declare CMlLabel picked <=> Mtx_T3;
  picked.Value = word;
  declare Integer Mtx_T4;
  if (n > 3) {
    Mtx_T4 = n;
  } else {
    Mtx_T4 = big;
  }
  log("" ^ Mtx_T4);
  log("" ^ half);
}
