const mode = new URLSearchParams(location.search).get("mode") || "ajax";
const statusLine = document.querySelector("#status");
const input = document.querySelector("#text");
const button = document.querySelector("form button");
const list = document.querySelector("#messages");
const activeLink = [...document.querySelectorAll(".modes a")]
    .find(link => new URL(link.href).searchParams.get("mode") === mode);
activeLink?.setAttribute("aria-current", "page");
let lastId = 0;
let socket;

function show(items) {
    for (const item of items) {
        if (item.id <= lastId) continue;
        const li = document.createElement("li");
        li.textContent = item.text;
        list.append(li);
        lastId = item.id;
    }
}

async function receive(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Ошибка получения сообщений");
    show(await response.json());
}

async function refresh() {
    try { await receive("/api/messages"); }
    catch (err) { statusLine.textContent = err.message; }
}

async function poll() {
    while (true) {
        try { await receive("/api/poll?after=" + lastId); }
        catch {
            statusLine.textContent = "Повтор подключения…";
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
        }
        statusLine.textContent = "Ожидание нового сообщения";
    }
}

if (mode === "ws") {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(protocol + "//" + location.host + "/ws");
    socket.onopen = () => {
        button.disabled = false;
        statusLine.textContent = "Соединение открыто";
    };
    socket.onmessage = event => show(JSON.parse(event.data));
    socket.onclose = () => {
        button.disabled = true;
        statusLine.textContent = "Соединение закрыто. Обновите страницу.";
    };
} else if (mode === "comet") {
    button.disabled = false;
    statusLine.textContent = "Ожидание нового сообщения";
    poll();
} else {
    button.disabled = false;
    statusLine.textContent = "Обновление каждые 2 секунды";
    refresh();
    setInterval(refresh, 2000);
}

document.querySelector("form").onsubmit = async event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const body = JSON.stringify({ text });
    try {
        if (mode === "ws") {
            socket.send(body);
        } else {
            const response = await fetch("/api/messages", {
                method: "POST", headers: { "Content-Type": "application/json" }, body
            });
            if (!response.ok) throw new Error("Ошибка отправки");
        }
        if (input.value.trim() === text) input.value = "";
    } catch (err) {
        statusLine.textContent = err.message;
    }
};
