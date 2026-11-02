{
  foreach (event in PendingEvents) {
    switch (event.Type) {
      case CMlScriptEvent::Type::MouseClick: {
        log("click");
      }
      case CMlScriptEvent::Type::MouseOver: {
        log("over");
      }
      default: {
        log("other");
      }
    }
  }
}
