{
  declare CMlLabel label <=> (Page.GetFirstChild("title") as CMlLabel);
  label.Value = "ready";
  (Page.GetFirstChild("bg") as CMlQuad).Visible = False;
}
