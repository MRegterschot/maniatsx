// File-based bridge for maniatsx visual tests: requests in inbox/<id>.json, answers in outbox/<id>.json.

[Setting category="General" name="Enabled"]
bool S_Enabled = true;

[Setting category="General" name="Poll interval (ms)" min=20 max=2000]
uint S_PollMs = 100;

string g_inbox;
string g_outbox;
string g_lastCmd = "(none)";

// Layers we created, and other layers we hid; only valid while g_app is the current ManiaApp
CGameManiaApp@ g_app;
string[] g_pages;
CGameUILayer@[] g_layers;
CGameUILayer@[] g_hidden;

void Main() {
    g_inbox = IO::FromStorageFolder("inbox");
    g_outbox = IO::FromStorageFolder("outbox");
    IO::CreateFolder(g_inbox);
    IO::CreateFolder(g_outbox);
    print("Manialink Bridge watching " + g_inbox);

    while (true) {
        if (S_Enabled) Poll();
        sleep(S_PollMs);
    }
}

void OnDestroyed() { ClearAll(); }
void OnDisabled() { ClearAll(); }

void RenderMenu() {
    if (UI::MenuItem("\\$0cfManialink Bridge\\$z  last: " + g_lastCmd + "  layers: " + g_layers.Length, "", S_Enabled)) {
        S_Enabled = !S_Enabled;
    }
}

void Poll() {
    auto files = IO::IndexFolder(g_inbox, false);
    for (uint i = 0; i < files.Length; i++) {
        string path = files[i];
        if (!path.EndsWith(".json")) continue;
        auto parts = path.Replace("\\", "/").Split("/");
        string id = parts[parts.Length - 1].Replace(".json", "");

        Json::Value@ res;
        try {
            auto req = Json::FromFile(path);
            IO::Delete(path);
            @res = Handle(req);
        } catch {
            string info = getExceptionInfo();
            warn("request " + id + " failed: " + info);
            if (IO::FileExists(path)) IO::Delete(path);
            @res = Err("exception: " + info);
        }
        string tmp = g_outbox + "/" + id + ".tmp";
        Json::ToFile(tmp, res);
        IO::Move(tmp, g_outbox + "/" + id + ".json");
    }
}

Json::Value@ Err(const string &in msg) {
    auto r = Json::Object();
    r["ok"] = false;
    r["error"] = msg;
    return r;
}

Json::Value@ Handle(Json::Value@ req) {
    string cmd = req["cmd"];
    g_lastCmd = cmd;
    SyncApp();
    if (cmd == "ping") return CmdPing();
    if (cmd == "show") return CmdShow(req);
    if (cmd == "inspect") return CmdInspect(req);
    if (cmd == "screenshot") return CmdScreenshot(req);
    if (cmd == "clear") return CmdClear(req);
    return Err("unknown cmd " + cmd);
}

// The playground's ManiaApp when in a map, else the menu's
CGameManiaApp@ CurrentApp(string &out context) {
    auto app = cast<CTrackMania>(GetApp());
    if (app is null) { context = "none"; return null; }
    if (app.Network !is null && app.Network.ClientManiaAppPlayground !is null) {
        context = "playground";
        return app.Network.ClientManiaAppPlayground;
    }
    if (app.MenuManager !is null && app.MenuManager.MenuCustom_CurrentManiaApp !is null) {
        context = "menu";
        return app.MenuManager.MenuCustom_CurrentManiaApp;
    }
    context = "none";
    return null;
}

// Leaving or entering a map replaces the ManiaApp and its layers; forget handles from the old one
void SyncApp() {
    string context;
    auto app = CurrentApp(context);
    if (app is g_app) return;
    @g_app = app;
    g_pages.RemoveRange(0, g_pages.Length);
    g_layers.RemoveRange(0, g_layers.Length);
    g_hidden.RemoveRange(0, g_hidden.Length);
}

bool IsOurs(CGameUILayer@ layer) {
    for (uint i = 0; i < g_layers.Length; i++) if (g_layers[i] is layer) return true;
    return false;
}

int PageIndex(const string &in page) {
    for (uint i = 0; i < g_pages.Length; i++) if (g_pages[i] == page) return int(i);
    return -1;
}

Json::Value@ CmdPing() {
    string context;
    auto app = CurrentApp(context);
    auto r = Json::Object();
    r["ok"] = true;
    r["context"] = context;
    r["layers"] = app is null ? 0 : int(app.UILayers.Length);
    r["pages"] = int(g_pages.Length);
    r["display"] = Vec2(vec2(Display::GetWidth(), Display::GetHeight()));
    return r;
}

Json::Value@ CmdShow(Json::Value@ req) {
    if (g_app is null) return Err("no ManiaApp: open a map or the main menu");
    string page = req["page"];
    string xml = req["xml"];
    int waitFrames = req.HasKey("waitFrames") ? int(req["waitFrames"]) : 10;
    bool hideOthers = req.HasKey("hideOthers") && bool(req["hideOthers"]);

    int idx = PageIndex(page);
    CGameUILayer@ layer;
    if (idx >= 0) {
        @layer = g_layers[idx];
    } else {
        @layer = g_app.UILayerCreate();
        if (layer is null) return Err("UILayerCreate returned null");
        g_pages.InsertLast(page);
        g_layers.InsertLast(layer);
    }
    if (hideOthers) HideOthers();
    layer.Type = CGameUILayer::EUILayerType::Normal;
    layer.IsVisible = true;
    layer.ManialinkPageUtf8 = xml;

    for (int i = 0; i < waitFrames; i++) yield();
    return Inspect(layer);
}

Json::Value@ CmdInspect(Json::Value@ req) {
    int idx = PageIndex(string(req["page"]));
    if (idx < 0) return Err("unknown page " + string(req["page"]));
    return Inspect(g_layers[idx]);
}

Json::Value@ Inspect(CGameUILayer@ layer) {
    auto r = Json::Object();
    r["ok"] = true;
    r["scriptRunning"] = layer.IsLocalPageScriptRunning;
    auto page = layer.LocalPage;
    if (page is null || page.MainFrame is null) {
        r["tree"] = Json::Value();
        return r;
    }
    r["tree"] = ControlToJson(page.MainFrame, true);
    return r;
}

Json::Value@ Vec2(vec2 v) {
    auto a = Json::Array();
    a.Add(Round(v.x));
    a.Add(Round(v.y));
    return a;
}

Json::Value@ Color(vec3 c) {
    auto a = Json::Array();
    a.Add(Round(c.x));
    a.Add(Round(c.y));
    a.Add(Round(c.z));
    return a;
}

// Three decimals keep snapshots stable across float noise
float Round(float v) { return Math::Round(v * 1000.0f) / 1000.0f; }

Json::Value@ ControlToJson(CGameManialinkControl@ c, bool parentVisible) {
    auto o = Json::Object();
    auto info = Reflection::TypeOf(c);
    o["type"] = info is null ? "?" : info.Name.Replace("CGameManialink", "").ToLower();
    if (c.ControlId != "") o["id"] = c.ControlId;
    auto classes = Json::Array();
    for (uint i = 0; i < c.ControlClasses.Length; i++) classes.Add(c.ControlClasses[i]);
    if (classes.Length > 0) o["classes"] = classes;
    o["pos"] = Vec2(c.AbsolutePosition_V3);
    o["size"] = Vec2(c.Size);
    o["scale"] = Round(c.AbsoluteScale);
    o["z"] = Round(c.ZIndex);
    bool visible = parentVisible && c.Visible;
    o["visible"] = visible;

    auto label = cast<CGameManialinkLabel>(c);
    if (label !is null) {
        o["text"] = string(label.Value);
        o["textColor"] = Color(label.TextColor);
        o["opacity"] = Round(label.Opacity);
    }
    auto quad = cast<CGameManialinkQuad>(c);
    if (quad !is null) {
        o["bgColor"] = Color(quad.BgColor);
        o["opacity"] = Round(quad.Opacity);
        if (quad.ImageUrl != "") o["image"] = quad.ImageUrl;
    }
    auto frame = cast<CGameManialinkFrame>(c);
    if (frame !is null) {
        auto children = Json::Array();
        for (uint i = 0; i < frame.Controls.Length; i++) children.Add(ControlToJson(frame.Controls[i], visible));
        o["children"] = children;
    }
    return o;
}

void HideOthers() {
    if (g_hidden.Length > 0) return;
    for (uint i = 0; i < g_app.UILayers.Length; i++) {
        auto layer = g_app.UILayers[i];
        if (layer is null || IsOurs(layer) || !layer.IsVisible) continue;
        layer.IsVisible = false;
        g_hidden.InsertLast(layer);
    }
}

void RestoreOthers() {
    for (uint i = 0; i < g_hidden.Length; i++) g_hidden[i].IsVisible = true;
    g_hidden.RemoveRange(0, g_hidden.Length);
}

Json::Value@ CmdScreenshot(Json::Value@ req) {
    auto app = GetApp();
    if (app is null || app.Viewport is null) return Err("no viewport");
    auto vp = app.Viewport;
    uint timeoutMs = req.HasKey("timeoutMs") ? uint(int(req["timeoutMs"])) : 5000;
    bool force = req.HasKey("width") && req.HasKey("height");
    bool prevForce = vp.ScreenShotForceRes;
    uint prevW = vp.ScreenShotWidth;
    uint prevH = vp.ScreenShotHeight;
    if (force) {
        vp.ScreenShotForceRes = true;
        vp.ScreenShotWidth = uint(int(req["width"]));
        vp.ScreenShotHeight = uint(int(req["height"]));
    }

    // Callers delete shots after reading, so the game may reuse the previous name for the new file
    string before = string(vp.ScreenShotFullName);
    bool beforeExisted = before != "" && IO::FileExists(before);
    vp.ScreenShotDoCaptureTga();
    uint start = Time::Now;
    string path = "";
    while (Time::Now - start < timeoutMs) {
        yield();
        string name = string(vp.ScreenShotFullName);
        if (name == "" || !IO::FileExists(name)) continue;
        if (name != before || !beforeExisted) { path = name; break; }
    }
    // Wait for the writer to finish: same size on two checks
    if (path != "") {
        uint64 last = 0;
        while (Time::Now - start < timeoutMs) {
            uint64 size = IO::FileSize(path);
            if (size > 0 && size == last) break;
            last = size;
            sleep(50);
        }
    }

    if (force) {
        vp.ScreenShotForceRes = prevForce;
        vp.ScreenShotWidth = prevW;
        vp.ScreenShotHeight = prevH;
    }
    if (path == "") return Err("screenshot timed out; last name: " + string(vp.ScreenShotFullName));
    auto r = Json::Object();
    r["ok"] = true;
    r["path"] = path;
    return r;
}

Json::Value@ CmdClear(Json::Value@ req) {
    if (req.HasKey("page")) {
        int idx = PageIndex(string(req["page"]));
        if (idx >= 0) {
            if (g_app !is null) g_app.UILayerDestroy(g_layers[idx]);
            g_pages.RemoveAt(idx);
            g_layers.RemoveAt(idx);
        }
        if (g_layers.Length == 0) RestoreOthers();
    } else {
        ClearAll();
    }
    return CmdPing();
}

void ClearAll() {
    SyncApp();
    if (g_app !is null) {
        for (uint i = 0; i < g_layers.Length; i++) g_app.UILayerDestroy(g_layers[i]);
        RestoreOthers();
    }
    g_pages.RemoveRange(0, g_pages.Length);
    g_layers.RemoveRange(0, g_layers.Length);
    g_hidden.RemoveRange(0, g_hidden.Length);
}
