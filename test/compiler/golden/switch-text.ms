{
  declare Text mode = "race";
  switch (mode) {
    case "race": {
      log("racing");
    }
    case "lobby": {
      log("waiting");
    }
    default: {
      log("unknown");
    }
  }
}
