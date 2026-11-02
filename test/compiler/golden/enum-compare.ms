{
  foreach (event in PendingEvents) {
    if (event.Type == CMlScriptEvent::Type::MouseClick) {
      log(event.ControlId);
    } else if (event.Type != CMlScriptEvent::Type::MouseOver) {
      log("other");
    }
  }
}
