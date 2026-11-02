{
  declare CMlLabel label <=> (Page.GetFirstChild("name") as CMlLabel);
  label.Value = LocalUser.Name;
}
