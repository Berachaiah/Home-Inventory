let deferredPrompt = null;

document.addEventListener("DOMContentLoaded", () => {

    if (window.matchMedia("(display-mode: standalone)").matches) {
        return;
    }

    const banner = document.createElement("div");
    banner.innerHTML = `
    <div id="pwa-banner" style="
        position:fixed;
        left:16px;
        right:16px;
        bottom:20px;
        background:#17375E;
        color:white;
        border-radius:16px;
        padding:18px;
        box-shadow:0 12px 40px rgba(0,0,0,.35);
        z-index:999999;
        display:none;
        font-family:system-ui;
    ">
        <div style="font-size:18px;font-weight:700">
            📱 Install Home Inventory
        </div>

        <div style="margin-top:8px;opacity:.9">
            Install this app for quicker access and an app-like experience.
        </div>

        <div style="margin-top:16px;display:flex;gap:12px">
            <button id="install-btn"
                style="
                    background:#F4A100;
                    color:#111;
                    border:none;
                    padding:10px 20px;
                    border-radius:10px;
                    font-weight:bold;
                    cursor:pointer;">
                Install
            </button>

            <button id="dismiss-btn"
                style="
                    background:#ffffff22;
                    color:white;
                    border:none;
                    padding:10px 20px;
                    border-radius:10px;
                    cursor:pointer;">
                Later
            </button>
        </div>
    </div>
    `;

    document.body.appendChild(banner);

    const panel = document.getElementById("pwa-banner");

    window.addEventListener("beforeinstallprompt", (e) => {

        console.log("beforeinstallprompt fired");

        e.preventDefault();

        deferredPrompt = e;

        panel.style.display = "block";

    });

    document.getElementById("install-btn").onclick = async () => {

        if (!deferredPrompt) {
            alert("Installation isn't available yet.");
            return;
        }

        deferredPrompt.prompt();

        await deferredPrompt.userChoice;

        panel.remove();

        deferredPrompt = null;
    };

    document.getElementById("dismiss-btn").onclick = () => {

        panel.remove();

    };

    window.addEventListener("appinstalled", () => {

        console.log("App installed");

        panel.remove();

    });

});
