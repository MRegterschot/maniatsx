{
  declare CMlLabel label <=> (Page.GetFirstChild("x") as CMlLabel);
  if (label == Null) {
    log("missing");
  }
  if (label != Null) {
    label.Value = "found";
  }
  declare Ident id = NullId;
  if (id == NullId) {
    log("no id");
  }
}
