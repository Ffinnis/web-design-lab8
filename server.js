const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { WebSocketServer, WebSocket } = require("ws");

const messages = [];
const waiting = new Set();
const types = { html: "text/html", css: "text/css", js: "text/javascript" };
const files = new Set(["index.html", "progress.html", "progress.js", "chat.js", "styles.css"]);

function json(res, data, status = 200) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store" });
    res.end(JSON.stringify(data));
}

function publish(raw) {
    const { text } = JSON.parse(raw);
    if (typeof text !== "string" || !text.trim() || text.length > 500) {
        throw new Error("Введите от 1 до 500 символов");
    }
    const item = { id: messages.length + 1, text: text.trim() };
    messages.push(item);
    for (const res of waiting) json(res, [item]);
    waiting.clear();
    for (const peer of sockets.clients) {
        if (peer.readyState === WebSocket.OPEN) peer.send(JSON.stringify([item]));
    }
    return item;
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/api/messages") {
        return json(res, messages);
    }
    if (req.method === "POST" && url.pathname === "/api/messages") {
        try {
            const chunks = [];
            let bytes = 0;
            for await (const chunk of req) {
                bytes += chunk.length;
                if (bytes > 4096) return json(res, { error: "Слишком длинный запрос" }, 413);
                chunks.push(chunk);
            }
            return json(res, publish(Buffer.concat(chunks).toString("utf8")), 201);
        } catch {
            return json(res, { error: "Некорректное сообщение" }, 400);
        }
    }
    if (req.method === "GET" && url.pathname === "/api/poll") {
        const after = Number(url.searchParams.get("after") ?? 0);
        if (!Number.isSafeInteger(after) || after < 0 || after > messages.length) {
            return json(res, { error: "Некорректный номер" }, 400);
        }
        const fresh = messages.slice(after);
        if (fresh.length) return json(res, fresh);
        waiting.add(res);
        res.once("close", () => waiting.delete(res));
        return;
    }
    const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (req.method !== "GET" || !files.has(name)) {
        res.writeHead(404);
        return res.end();
    }
    const file = fs.createReadStream(path.join(__dirname, "public", name));
    res.setHeader("Content-Type", types[name.split(".").pop()] + "; charset=utf-8");
    file.on("error", () => { res.writeHead(404); res.end(); });
    file.pipe(res);
});

const sockets = new WebSocketServer({ server, path: "/ws", maxPayload: 4096 });
sockets.on("connection", peer => {
    peer.send(JSON.stringify(messages));
    peer.on("error", () => peer.terminate());
    peer.on("message", raw => {
        try { publish(raw.toString()); }
        catch { peer.close(1007, "Invalid message"); }
    });
});

server.listen(3000, "127.0.0.1", () => console.log("http://127.0.0.1:3000"));
