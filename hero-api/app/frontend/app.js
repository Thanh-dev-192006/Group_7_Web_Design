const API = "http://127.0.0.1:8000";
const message = document.querySelector("#message");
const table = document.querySelector("#heroes");

function showMessage(text, error = false) {
    message.textContent = text;
    message.style.color = error ? "#b42318" : "#176b3a";
}

async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        headers: { "Content-Type": "application/json" }, ...options,
    });
    if (!response.ok) throw new Error((await response.json()).detail || response.statusText);
    return response.status === 204 ? null : response.json();
}

function render(heroes) {
    table.innerHTML = heroes.map(hero => `
        <tr>
            <td>${hero.name}</td><td>${hero.age ?? "—"}</td><td>${hero.power ?? "—"}</td>
            <td class="status">${hero.status}</td>
            <td><button data-retire="${hero.id}">${hero.status === "active" ? "Retire" : "Activate"}</button>
            <button class="danger" data-delete="${hero.id}">Delete</button></td>
        </tr>`).join("");
}

async function loadHeroes() {
    const params = new URLSearchParams();
    const name = document.querySelector("#search").value.trim();
    const status = document.querySelector("#status").value;
    if (name) params.set("name", name);
    if (status) params.set("status", status);
    render(await request(`/heroes?${params}`));
}

document.querySelector("#hero-form").addEventListener("submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    if (data.age === "") delete data.age; else data.age = Number(data.age);
    try { await request("/heroes", { method: "POST", body: JSON.stringify(data) }); event.target.reset(); showMessage("Hero created"); await loadHeroes(); }
    catch (error) { showMessage(error.message, true); }
});

document.querySelector("#refresh").addEventListener("click", loadHeroes);
document.querySelector("#search").addEventListener("change", loadHeroes);
document.querySelector("#status").addEventListener("change", loadHeroes);
table.addEventListener("click", async event => {
    const button = event.target;
    try {
        if (button.dataset.delete) await request(`/heroes/${button.dataset.delete}`, { method: "DELETE" });
        if (button.dataset.retire) await request(`/heroes/${button.dataset.retire}`, { method: "PATCH", body: JSON.stringify({ status: button.textContent === "Retire" ? "retired" : "active" }) });
        await loadHeroes();
    } catch (error) { showMessage(error.message, true); }
});

loadHeroes().catch(error => showMessage(`Cannot connect to API: ${error.message}`, true));
